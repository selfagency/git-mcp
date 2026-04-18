import { randomUUID } from 'node:crypto';
import { getGit, toGitError, validatePathArguments } from '../git/client.js';
import type {
  WorkflowDefinition,
  WorkflowExecutionStatus,
  WorkflowLifecycleAction,
  WorkflowName,
  WorkflowState,
  WorkflowStepDefinition,
  WorkflowStepResult,
} from '../types.js';

const WORKFLOW_STATE_KEY = 'gitworkflow.state.json';

export interface WorkflowOptions {
  readonly action: WorkflowLifecycleAction;
  readonly workflow?: WorkflowName;
  readonly baseBranch?: string;
  readonly logCount?: number;
  readonly mode?: 'cherry-pick' | 'am';
  readonly targetBranch?: string;
  readonly sourceCommits?: readonly string[];
  readonly patchFiles?: readonly string[];
  readonly threeWay?: boolean;
  readonly backupBranch?: string;
  readonly resetTo?: string;
  readonly confirmHardReset?: boolean;
  readonly publish?: boolean;
  readonly remote?: string;
  readonly forceWithLease?: boolean;
  readonly setUpstream?: boolean;
  readonly fetchFirst?: boolean;
  readonly rebaseOnto?: string;
}

export interface WorkflowActionResult {
  readonly markdown: string;
  readonly data?: unknown;
}

interface ActiveWorkflow {
  readonly definition: WorkflowDefinition;
  readonly state: WorkflowState;
}

function assertSafeRefLike(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} cannot be empty.`);
  }
  if (trimmed.startsWith('-')) {
    throw new Error(`${name} cannot start with '-'.`);
  }
  if (trimmed.includes('\u0000') || trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error(`${name} contains invalid control characters.`);
  }
  return trimmed;
}

function assertSafeRemoteName(value: string): string {
  return assertSafeRefLike(value, 'remote');
}

function classifyStatus(errorMessage: string): WorkflowExecutionStatus {
  if (/(CONFLICT|merge conflict|rebase in progress|cherry-pick in progress|patch failed)/i.test(errorMessage)) {
    return 'paused';
  }

  return 'failed';
}

function formatState(state: WorkflowState): string {
  const lines = [
    `Workflow: ${state.workflow}`,
    `ID: ${state.id}`,
    `Status: ${state.status}`,
    `Current step: ${state.currentStep + 1}/${state.steps.length}`,
  ];

  if (state.pauseReason) {
    lines.push(`Pause reason: ${state.pauseReason}`);
  }

  lines.push('', 'Steps:');
  for (const step of state.steps) {
    lines.push(`- [${step.status}] #${step.index + 1} ${step.name}${step.error ? ` — ${step.error}` : ''}`);
  }

  return lines.join('\n');
}

function renderResult(markdown: string, data: unknown): WorkflowActionResult {
  return {
    markdown,
    data,
  };
}

async function writeState(repoPath: string, state: WorkflowState): Promise<void> {
  const git = getGit(repoPath);
  await git.raw(['config', '--local', WORKFLOW_STATE_KEY, JSON.stringify(state)]);
}

async function clearState(repoPath: string): Promise<void> {
  const git = getGit(repoPath);
  try {
    await git.raw(['config', '--local', '--unset-all', WORKFLOW_STATE_KEY]);
  } catch {
    // no-op if absent
  }
}

async function readState(repoPath: string): Promise<WorkflowState | null> {
  const git = getGit(repoPath);
  try {
    const raw = await git.raw(['config', '--local', '--get', WORKFLOW_STATE_KEY]);
    const parsed = JSON.parse(raw.trim()) as WorkflowState;
    return parsed;
  } catch {
    return null;
  }
}

function toStepResult(index: number, name: string): WorkflowStepResult {
  return {
    index,
    name,
    status: 'pending',
  };
}

function buildSnapshotDefinition(options: WorkflowOptions): WorkflowDefinition {
  const baseBranch = assertSafeRefLike(options.baseBranch ?? 'main', 'baseBranch');
  const logCount = options.logCount ?? 12;

  const steps: readonly WorkflowStepDefinition[] = [
    {
      kind: 'gitRaw',
      name: 'remotes',
      args: ['remote', '-v'],
      readOnly: true,
    },
    {
      kind: 'gitRaw',
      name: 'branches',
      args: ['branch', '-vv'],
      readOnly: true,
    },
    {
      kind: 'gitRaw',
      name: 'merge_base',
      args: ['merge-base', 'HEAD', baseBranch],
      readOnly: true,
    },
    {
      kind: 'gitRaw',
      name: 'graph_log',
      args: ['log', '--graph', '--decorate', '--oneline', '--max-count', String(logCount), '--all'],
      readOnly: true,
    },
    {
      kind: 'gitRaw',
      name: 'status_short',
      args: ['status', '--short'],
      readOnly: true,
    },
  ];

  return {
    workflow: 'snapshot',
    steps,
    params: {
      baseBranch,
      logCount,
    },
  };
}

function buildReplayDefinition(repoPath: string, options: WorkflowOptions): WorkflowDefinition {
  const mode = options.mode ?? 'cherry-pick';
  const steps: WorkflowStepDefinition[] = [];

  if (options.targetBranch) {
    const targetBranch = assertSafeRefLike(options.targetBranch, 'targetBranch');
    steps.push({
      kind: 'gitRaw',
      name: `checkout_${targetBranch}`,
      args: ['checkout', targetBranch],
      readOnly: false,
    });
  }

  if (options.resetTo) {
    if (!options.confirmHardReset) {
      throw new Error('confirmHardReset=true is required when resetTo is provided.');
    }
    const resetTo = assertSafeRefLike(options.resetTo, 'resetTo');
    steps.push({
      kind: 'gitRaw',
      name: `hard_reset_${resetTo}`,
      args: ['reset', '--hard', resetTo],
      readOnly: false,
      destructive: true,
    });
  }

  if (mode === 'cherry-pick') {
    const commits = options.sourceCommits ?? [];
    if (commits.length === 0) {
      throw new Error('sourceCommits is required for replay mode cherry-pick.');
    }

    for (const commit of commits) {
      const safeCommit = assertSafeRefLike(commit, 'sourceCommits item');
      steps.push({
        kind: 'gitRaw',
        name: `cherry_pick_${safeCommit}`,
        args: ['cherry-pick', safeCommit],
        readOnly: false,
        resumable: {
          continueArgs: ['cherry-pick', '--continue'],
          abortArgs: ['cherry-pick', '--abort'],
        },
      });
    }
  } else {
    const patchFiles = options.patchFiles ?? [];
    if (patchFiles.length === 0) {
      throw new Error('patchFiles is required for replay mode am.');
    }

    const safePatchFiles = validatePathArguments(repoPath, patchFiles);

    const args = ['am'];
    if (options.threeWay ?? true) {
      args.push('--3way');
    }
    args.push(...safePatchFiles);

    steps.push({
      kind: 'gitRaw',
      name: 'apply_patch_series',
      args,
      readOnly: false,
      resumable: {
        continueArgs: ['am', '--continue'],
        abortArgs: ['am', '--abort'],
      },
    });
  }

  if (options.publish) {
    const remote = assertSafeRemoteName(options.remote ?? 'origin');
    const pushArgs = ['push'];
    if (options.setUpstream) {
      pushArgs.push('--set-upstream');
    }
    if (options.forceWithLease) {
      pushArgs.push('--force-with-lease');
    }
    pushArgs.push(remote);

    if (options.targetBranch) {
      pushArgs.push(assertSafeRefLike(options.targetBranch, 'targetBranch'));
    }

    steps.push({
      kind: 'gitRaw',
      name: `publish_${remote}`,
      args: pushArgs,
      readOnly: false,
      openWorld: true,
    });
  }

  return {
    workflow: 'replay',
    steps,
    params: {
      mode,
      targetBranch: options.targetBranch ? assertSafeRefLike(options.targetBranch, 'targetBranch') : null,
      sourceCommits: options.sourceCommits ?? [],
      patchFiles:
        mode === 'am' ? validatePathArguments(repoPath, options.patchFiles ?? []) : (options.patchFiles ?? []),
      publish: options.publish ?? false,
      remote: options.remote ?? null,
    },
  };
}

function buildBranchSurgeryDefinition(options: WorkflowOptions): WorkflowDefinition {
  const targetBranch = options.targetBranch ? assertSafeRefLike(options.targetBranch, 'targetBranch') : undefined;
  if (!targetBranch) {
    throw new Error('targetBranch is required for branch_surgery workflow.');
  }

  if (options.resetTo && !options.confirmHardReset) {
    throw new Error('confirmHardReset=true is required when resetTo is provided.');
  }

  const backupBranch = options.backupBranch
    ? assertSafeRefLike(options.backupBranch, 'backupBranch')
    : `backup/${targetBranch.replaceAll('/', '-')}`;
  const steps: WorkflowStepDefinition[] = [
    {
      kind: 'gitRaw',
      name: `backup_branch_${backupBranch}`,
      args: ['branch', backupBranch, 'HEAD'],
      readOnly: false,
    },
    {
      kind: 'gitRaw',
      name: `checkout_${targetBranch}`,
      args: ['checkout', targetBranch],
      readOnly: false,
    },
  ];

  if (options.resetTo) {
    const resetTo = assertSafeRefLike(options.resetTo, 'resetTo');
    steps.push({
      kind: 'gitRaw',
      name: `hard_reset_${resetTo}`,
      args: ['reset', '--hard', resetTo],
      readOnly: false,
      destructive: true,
    });
  }

  for (const commit of options.sourceCommits ?? []) {
    const safeCommit = assertSafeRefLike(commit, 'sourceCommits item');
    steps.push({
      kind: 'gitRaw',
      name: `cherry_pick_${safeCommit}`,
      args: ['cherry-pick', safeCommit],
      readOnly: false,
      resumable: {
        continueArgs: ['cherry-pick', '--continue'],
        abortArgs: ['cherry-pick', '--abort'],
      },
    });
  }

  if (options.publish) {
    const remote = assertSafeRemoteName(options.remote ?? 'origin');
    const pushArgs = ['push'];
    if (options.setUpstream) {
      pushArgs.push('--set-upstream');
    }
    if (options.forceWithLease) {
      pushArgs.push('--force-with-lease');
    }
    pushArgs.push(remote, targetBranch);
    steps.push({
      kind: 'gitRaw',
      name: `publish_${remote}`,
      args: pushArgs,
      readOnly: false,
      openWorld: true,
    });
  }

  return {
    workflow: 'branch_surgery',
    steps,
    params: {
      targetBranch,
      backupBranch,
      resetTo: options.resetTo ?? null,
      sourceCommits: options.sourceCommits ?? [],
      publish: options.publish ?? false,
      remote: options.remote ?? null,
    },
  };
}

function buildPublishDefinition(options: WorkflowOptions): WorkflowDefinition {
  const targetBranch = options.targetBranch ? assertSafeRefLike(options.targetBranch, 'targetBranch') : undefined;
  if (!targetBranch) {
    throw new Error('targetBranch is required for publish workflow.');
  }

  const remote = assertSafeRemoteName(options.remote ?? 'origin');
  const steps: WorkflowStepDefinition[] = [];

  if (options.fetchFirst ?? true) {
    steps.push({
      kind: 'gitRaw',
      name: `fetch_${remote}`,
      args: ['fetch', '--prune', remote],
      readOnly: false,
      openWorld: true,
    });
  }

  steps.push({
    kind: 'gitRaw',
    name: `checkout_${targetBranch}`,
    args: ['checkout', targetBranch],
    readOnly: false,
  });

  if (options.rebaseOnto) {
    const rebaseOnto = assertSafeRefLike(options.rebaseOnto, 'rebaseOnto');
    steps.push({
      kind: 'gitRaw',
      name: `rebase_onto_${rebaseOnto}`,
      args: ['rebase', rebaseOnto],
      readOnly: false,
      resumable: {
        continueArgs: ['rebase', '--continue'],
        abortArgs: ['rebase', '--abort'],
      },
    });
  }

  const pushArgs = ['push'];
  if (options.setUpstream) {
    pushArgs.push('--set-upstream');
  }
  if (options.forceWithLease) {
    pushArgs.push('--force-with-lease');
  }
  pushArgs.push(remote, targetBranch);

  steps.push({
    kind: 'gitRaw',
    name: `push_${remote}`,
    args: pushArgs,
    readOnly: false,
    openWorld: true,
  });

  return {
    workflow: 'publish',
    steps,
    params: {
      targetBranch,
      remote,
      fetchFirst: options.fetchFirst ?? true,
      rebaseOnto: options.rebaseOnto ?? null,
      forceWithLease: options.forceWithLease ?? false,
      setUpstream: options.setUpstream ?? false,
    },
  };
}

function buildDefinition(repoPath: string, options: WorkflowOptions): WorkflowDefinition {
  switch (options.workflow) {
    case 'snapshot':
      return buildSnapshotDefinition(options);
    case 'replay':
      return buildReplayDefinition(repoPath, options);
    case 'branch_surgery':
      return buildBranchSurgeryDefinition(options);
    case 'publish':
      return buildPublishDefinition(options);
    default:
      throw new Error(`Unsupported workflow: ${options.workflow ?? 'undefined'}`);
  }
}

function buildInitialState(definition: WorkflowDefinition): WorkflowState {
  return {
    id: randomUUID(),
    workflow: definition.workflow,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: 0,
    steps: definition.steps.map((step, index) => toStepResult(index, step.name)),
    params: definition.params,
  };
}

async function runStep(repoPath: string, step: WorkflowStepDefinition): Promise<string> {
  const git = getGit(repoPath);
  if (step.kind === 'gitRaw') {
    const output = await git.raw([...step.args]);
    return output.trim() || 'OK';
  }

  throw new Error(`Unsupported step kind: ${(step as { kind: string }).kind}`);
}

function attachStepResult(state: WorkflowState, index: number, patch: Partial<WorkflowStepResult>): WorkflowState {
  const steps = state.steps.map(step => (step.index === index ? { ...step, ...patch } : step));
  return {
    ...state,
    steps,
    updatedAt: new Date().toISOString(),
  };
}

async function execute(repoPath: string, active: ActiveWorkflow): Promise<WorkflowState> {
  let state = active.state;

  for (let index = state.currentStep; index < active.definition.steps.length; index += 1) {
    const step = active.definition.steps[index]!;

    try {
      const output = await runStep(repoPath, step);
      state = attachStepResult(state, index, {
        status: 'completed',
        output,
      });
      state = {
        ...state,
        currentStep: index + 1,
      };
      await writeState(repoPath, state);
    } catch (error) {
      const gitError = toGitError(error);
      const status = classifyStatus(gitError.message);
      state = attachStepResult(state, index, {
        status: 'failed',
        error: gitError.message,
      });
      state = {
        ...state,
        status,
        pauseReason: gitError.message,
        currentStep: index,
      };
      await writeState(repoPath, state);
      return state;
    }
  }

  state = {
    ...state,
    status: 'completed',
    currentStep: active.definition.steps.length,
    pauseReason: undefined,
    updatedAt: new Date().toISOString(),
  };
  await writeState(repoPath, state);
  return state;
}

async function continuePaused(repoPath: string, state: WorkflowState): Promise<WorkflowState> {
  const definition = buildDefinition(repoPath, {
    action: 'start',
    workflow: state.workflow,
    ...(state.params as Partial<WorkflowOptions>),
  } as WorkflowOptions);

  const currentStep = definition.steps[state.currentStep];
  if (!currentStep) {
    return {
      ...state,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };
  }

  if (state.status === 'paused' && currentStep.resumable) {
    try {
      const git = getGit(repoPath);
      const output = await git.raw([...currentStep.resumable.continueArgs]);
      let nextState = attachStepResult(state, state.currentStep, {
        status: 'completed',
        output: output.trim() || 'Continued',
        error: undefined,
      });
      nextState = {
        ...nextState,
        currentStep: state.currentStep + 1,
        status: 'running',
        pauseReason: undefined,
      };
      await writeState(repoPath, nextState);
      return execute(repoPath, { definition, state: nextState });
    } catch (error) {
      const gitError = toGitError(error);
      const failed = attachStepResult(state, state.currentStep, {
        status: 'failed',
        error: gitError.message,
      });
      const paused: WorkflowState = {
        ...failed,
        status: classifyStatus(gitError.message),
        pauseReason: gitError.message,
      };
      await writeState(repoPath, paused);
      return paused;
    }
  }

  const runnable: WorkflowState = {
    ...state,
    status: 'running',
    pauseReason: undefined,
  };
  await writeState(repoPath, runnable);
  return execute(repoPath, { definition, state: runnable });
}

async function abortActive(repoPath: string, state: WorkflowState): Promise<WorkflowState> {
  const definition = buildDefinition(repoPath, {
    action: 'start',
    workflow: state.workflow,
    ...(state.params as Partial<WorkflowOptions>),
  } as WorkflowOptions);
  const currentStep = definition.steps[state.currentStep];

  if (currentStep?.resumable?.abortArgs) {
    const git = getGit(repoPath);
    try {
      await git.raw([...currentStep.resumable.abortArgs]);
    } catch {
      // best-effort abort
    }
  }

  const aborted: WorkflowState = {
    ...state,
    status: 'aborted',
    updatedAt: new Date().toISOString(),
  };
  await writeState(repoPath, aborted);
  return aborted;
}

function getSupportedWorkflows(): readonly WorkflowName[] {
  return ['snapshot', 'replay', 'branch_surgery', 'publish'];
}

export async function runWorkflowAction(repoPath: string, options: WorkflowOptions): Promise<WorkflowActionResult> {
  if (options.action === 'list') {
    const workflows = getSupportedWorkflows();
    return renderResult(`Supported workflows: ${workflows.join(', ')}`, { workflows });
  }

  const existingState = await readState(repoPath);

  if (options.action === 'status') {
    if (!existingState) {
      return renderResult('No active workflow state.', { state: null });
    }
    return renderResult(formatState(existingState), { state: existingState });
  }

  if (options.action === 'abort') {
    if (!existingState) {
      return renderResult('No active workflow to abort.', { state: null });
    }

    const aborted = await abortActive(repoPath, existingState);
    await clearState(repoPath);
    return renderResult(`Aborted workflow ${aborted.workflow} (${aborted.id}).`, { state: aborted });
  }

  if (options.action === 'continue') {
    if (!existingState) {
      throw new Error('No active workflow state found. Start a workflow first.');
    }

    const progressed = await continuePaused(repoPath, existingState);
    if (progressed.status === 'completed' || progressed.status === 'aborted') {
      await clearState(repoPath);
    }

    return renderResult(formatState(progressed), { state: progressed });
  }

  if (options.action === 'start') {
    if (!options.workflow) {
      throw new Error('workflow is required for action=start.');
    }

    if (existingState && (existingState.status === 'running' || existingState.status === 'paused')) {
      throw new Error(
        `Active workflow ${existingState.workflow} (${existingState.id}) is ${existingState.status}. ` +
          'Use action=status|continue|abort first.',
      );
    }

    const definition = buildDefinition(repoPath, options);
    const initial = buildInitialState(definition);
    await writeState(repoPath, initial);
    const completedState = await execute(repoPath, {
      definition,
      state: initial,
    });

    if (completedState.status === 'completed') {
      await clearState(repoPath);
    }

    return renderResult(formatState(completedState), {
      workflow: definition.workflow,
      state: completedState,
      steps: definition.steps,
    });
  }

  throw new Error(`Unsupported action: ${options.action}`);
}
