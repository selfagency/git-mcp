import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { getGit, validatePathArguments } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { runBisectAction, runStashAction, runTagAction } from '../services/advanced.service.js';
import { buildToolError } from '../utils/error-response.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

/** Lifecycle action shared by rebase/cherry-pick/merge. */
type LifecycleAction = 'start' | 'continue' | 'abort';

function buildError(error: unknown): ReturnType<typeof buildToolError> {
  return buildToolError(error);
}

/** Shared stash tool. */
function registerGitStashTool(server: McpServer): void {
  server.registerTool(
    'git_stash',
    {
      title: 'Git Stash',
      description: 'Stash, list, apply, pop, or drop stashes.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['save', 'list', 'apply', 'pop', 'drop']).default('list'),
        message: z.string().optional(),
        index: z.number().int().min(0).optional(),
        include_untracked: z.boolean().default(false),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      message,
      index,
      include_untracked,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'save' | 'list' | 'apply' | 'pop' | 'drop';
      message?: string;
      index?: number;
      include_untracked: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runStashAction(repoPath, { action, message, index, includeUntracked: include_untracked });
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

function buildRebaseArgs(
  action: 'start' | 'continue' | 'abort' | 'skip',
  opts: {
    interactive: boolean;
    autosquash: boolean;
    merges: boolean;
    onto?: string;
    upstream?: string;
    branch?: string;
  },
): string[] {
  switch (action) {
    case 'continue':
      return ['rebase', '--continue'];
    case 'abort':
      return ['rebase', '--abort'];
    case 'skip':
      return ['rebase', '--skip'];
    default: {
      const args = ['rebase'];
      if (opts.interactive) args.push('-i');
      if (opts.autosquash) args.push('--autosquash');
      if (opts.merges) args.push('--rebase-merges');
      if (opts.onto) args.push('--onto', opts.onto);
      if (!opts.upstream) throw new Error('upstream is required for rebase start.');
      args.push(opts.upstream);
      if (opts.branch) args.push(opts.branch);
      return args;
    }
  }
}

/** Shared rebase tool. */
function registerGitRebaseTool(server: McpServer): void {
  server.registerTool(
    'git_rebase',
    {
      title: 'Git Rebase',
      description: 'Rebase: start, continue, abort, or skip.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort', 'skip']).default('start'),
        interactive: z.boolean().default(false),
        autosquash: z.boolean().default(false),
        merges: z.boolean().default(false),
        onto: z.string().optional(),
        upstream: z.string().optional(),
        branch: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      interactive,
      autosquash,
      merges,
      onto,
      upstream,
      branch,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort' | 'skip';
      interactive: boolean;
      autosquash: boolean;
      merges: boolean;
      onto?: string;
      upstream?: string;
      branch?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const args = buildRebaseArgs(action, { interactive, autosquash, merges, onto, upstream, branch });
        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || 'Rebase completed.';
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

function buildCherryPickArgs(
  action: LifecycleAction,
  opts: {
    mainline?: number;
    record_origin: boolean;
    no_commit: boolean;
    strategy?: string;
    strategy_options?: string[];
    refs?: string[];
  },
): string[] {
  switch (action) {
    case 'continue':
      return ['cherry-pick', '--continue'];
    case 'abort':
      return ['cherry-pick', '--abort'];
    default: {
      const args = ['cherry-pick'];
      if (opts.mainline !== undefined) args.push('--mainline', String(opts.mainline));
      if (opts.record_origin) args.push('-x');
      if (opts.no_commit) args.push('--no-commit');
      if (opts.strategy) args.push('--strategy', opts.strategy);
      for (const option of opts.strategy_options ?? []) args.push('--strategy-option', option);
      if (!opts.refs || opts.refs.length === 0) throw new Error('refs is required for cherry_pick start.');
      args.push(...opts.refs);
      return args;
    }
  }
}

/** Shared cherry-pick tool. */
function registerGitCherryPickTool(server: McpServer): void {
  server.registerTool(
    'git_cherry_pick',
    {
      title: 'Git Cherry-Pick',
      description: 'Cherry-pick: start, continue, or abort.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort']).default('start'),
        refs: z.array(z.string()).optional(),
        mainline: z.number().int().min(1).optional(),
        record_origin: z.boolean().default(false),
        no_commit: z.boolean().default(false),
        strategy: z.string().optional(),
        strategy_options: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      refs,
      mainline,
      record_origin,
      no_commit,
      strategy,
      strategy_options,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort';
      refs?: string[];
      mainline?: number;
      record_origin: boolean;
      no_commit: boolean;
      strategy?: string;
      strategy_options?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const args = buildCherryPickArgs(action, {
          mainline,
          record_origin,
          no_commit,
          strategy,
          strategy_options,
          refs,
        });
        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || 'Cherry-pick completed.';
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

function buildMergeArgs(
  action: LifecycleAction,
  opts: {
    no_ff: boolean;
    ff_only: boolean;
    squash: boolean;
    no_commit: boolean;
    log: boolean;
    strategy?: string;
    strategy_options?: string[];
    conflict_style?: 'merge' | 'diff3' | 'zdiff3';
    refs?: string[];
  },
): string[] {
  if (action === 'continue') return ['merge', '--continue'];
  if (action === 'abort') return ['merge', '--abort'];
  if (!opts.refs || opts.refs.length === 0) throw new Error('refs is required for merge start.');

  const flags: ReadonlyArray<readonly [boolean, ...string[]]> = [
    [opts.no_ff, '--no-ff'],
    [opts.ff_only, '--ff-only'],
    [opts.squash, '--squash'],
    [opts.no_commit, '--no-commit'],
    [opts.log, '--log'],
    [!!opts.strategy, '--strategy', opts.strategy!],
    [!!opts.conflict_style, `--conflict=${opts.conflict_style}`],
  ];
  const strategyOptions = (opts.strategy_options ?? []).flatMap(option => ['--strategy-option', option]);
  return ['merge', ...flags.flatMap(([on, ...tokens]) => (on ? tokens : [])), ...strategyOptions, ...opts.refs];
}

/** Shared merge tool. */
function registerGitMergeTool(server: McpServer): void {
  server.registerTool(
    'git_merge',
    {
      title: 'Git Merge',
      description: 'Merge: start, continue, or abort.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort']).default('start'),
        refs: z.array(z.string()).optional(),
        no_ff: z.boolean().default(false),
        ff_only: z.boolean().default(false),
        squash: z.boolean().default(false),
        no_commit: z.boolean().default(false),
        log: z.boolean().default(false),
        strategy: z.string().optional(),
        strategy_options: z.array(z.string()).optional(),
        conflict_style: z.enum(['merge', 'diff3', 'zdiff3']).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      refs,
      no_ff,
      ff_only,
      squash,
      no_commit,
      log,
      strategy,
      strategy_options,
      conflict_style,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort';
      refs?: string[];
      no_ff: boolean;
      ff_only: boolean;
      squash: boolean;
      no_commit: boolean;
      log: boolean;
      strategy?: string;
      strategy_options?: string[];
      conflict_style?: 'merge' | 'diff3' | 'zdiff3';
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const args = buildMergeArgs(action, {
          no_ff,
          ff_only,
          squash,
          no_commit,
          log,
          strategy,
          strategy_options,
          conflict_style,
          refs,
        });
        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || 'Merge completed.';
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared bisect tool. */
function registerGitBisectTool(server: McpServer): void {
  server.registerTool(
    'git_bisect',
    {
      title: 'Git Bisect',
      description: 'Bisect: start, good, bad, skip, run, or reset.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'good', 'bad', 'skip', 'run', 'reset']).default('start'),
        ref: z.string().optional(),
        good_ref: z.string().optional(),
        bad_ref: z.string().optional(),
        command: z.string().optional(),
        command_args: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      ref,
      good_ref,
      bad_ref,
      command,
      command_args,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'good' | 'bad' | 'skip' | 'run' | 'reset';
      ref?: string;
      good_ref?: string;
      bad_ref?: string;
      command?: string;
      command_args?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runBisectAction(repoPath, {
          action,
          ref,
          goodRef: good_ref,
          badRef: bad_ref,
          command,
          commandArgs: command_args,
        });
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared tag tool. */
function registerGitTagTool(server: McpServer): void {
  server.registerTool(
    'git_tag',
    {
      title: 'Git Tag',
      description: 'Tag: list, create, or delete.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['list', 'create', 'delete']).default('list'),
        name: z.string().optional(),
        target: z.string().optional(),
        message: z.string().optional(),
        sign: z.boolean().optional().describe('Sign the tag. Defaults to the server GIT_AUTO_SIGN_TAGS setting.'),
        signing_key: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      name,
      target,
      message,
      sign,
      signing_key,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'list' | 'create' | 'delete';
      name?: string;
      target?: string;
      message?: string;
      sign?: boolean;
      signing_key?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runTagAction(repoPath, { action, name, target, message, sign, signingKey: signing_key });
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

type WorktreeArgs = { args: string[]; fallback: string };

function buildWorktreeArgs(
  action: 'add' | 'list' | 'remove' | 'lock' | 'unlock' | 'prune' | 'repair',
  opts: {
    path?: string;
    branch?: string;
    force: boolean;
    detached: boolean;
    lock_reason?: string;
    expire?: string;
    paths?: string[];
  },
): WorktreeArgs {
  return WORKTREE_BUILDERS[action](opts);
}

const WORKTREE_BUILDERS: Record<
  'add' | 'list' | 'remove' | 'lock' | 'unlock' | 'prune' | 'repair',
  (opts: {
    path?: string;
    branch?: string;
    force: boolean;
    detached: boolean;
    lock_reason?: string;
    expire?: string;
    paths?: string[];
  }) => WorktreeArgs
> = {
  list: () => ({ args: ['worktree', 'list', '--porcelain'], fallback: 'No worktrees.' }),
  remove: opts => {
    if (!opts.path) throw new Error('path is required for worktree remove.');
    const args = ['worktree', 'remove'];
    if (opts.force) args.push('--force');
    args.push(opts.path);
    return { args, fallback: `Removed worktree ${opts.path}.` };
  },
  lock: opts => worktreeLockBuilder('lock', opts),
  unlock: opts => worktreeLockBuilder('unlock', opts),
  prune: opts => {
    const args = ['worktree', 'prune'];
    if (opts.expire) args.push(`--expire=${opts.expire}`);
    return { args, fallback: 'Worktree prune completed.' };
  },
  repair: opts => {
    const args = ['worktree', 'repair'];
    if (opts.paths && opts.paths.length > 0) args.push(...opts.paths);
    return { args, fallback: 'Worktree repair completed.' };
  },
  add: opts => {
    if (!opts.path) throw new Error('path is required for worktree add.');
    const args = ['worktree', 'add'];
    if (opts.force) args.push('--force');
    if (opts.detached) args.push('--detach');
    if (opts.lock_reason) args.push('--lock', '--reason', opts.lock_reason);
    args.push(opts.path);
    if (opts.branch) args.push(opts.branch);
    else if (!opts.detached) throw new Error('branch is required for worktree add unless detached=true.');
    return { args, fallback: `Added worktree at ${opts.path}.` };
  },
};

function worktreeLockBuilder(action: 'lock' | 'unlock', opts: { path?: string; lock_reason?: string }): WorktreeArgs {
  if (!opts.path) throw new Error('path is required for worktree lock/unlock.');
  const args = ['worktree', action, opts.path];
  if (action === 'lock' && opts.lock_reason) args.push('--reason', opts.lock_reason);
  return { args, fallback: `Worktree ${action} completed for ${opts.path}.` };
}

/** Shared worktree tool. */
function registerGitWorktreeTool(server: McpServer): void {
  server.registerTool(
    'git_worktree',
    {
      title: 'Git Worktree',
      description: 'Worktree: add, list, remove, lock, unlock, prune, or repair.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'list', 'remove', 'lock', 'unlock', 'prune', 'repair']).default('list'),
        path: z.string().optional(),
        branch: z.string().optional(),
        force: z.boolean().default(false),
        detached: z.boolean().default(false),
        lock_reason: z.string().optional(),
        expire: z.string().optional(),
        paths: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      path,
      branch,
      force,
      detached,
      lock_reason,
      expire,
      paths,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'list' | 'remove' | 'lock' | 'unlock' | 'prune' | 'repair';
      path?: string;
      branch?: string;
      force: boolean;
      detached: boolean;
      lock_reason?: string;
      expire?: string;
      paths?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const { args, fallback } = buildWorktreeArgs(action, {
          path,
          branch,
          force,
          detached,
          lock_reason,
          expire,
          paths,
        });
        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || fallback;
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

type SubmoduleArgs = { args: string[]; fallback: string };

function buildSubmoduleArgs(
  action: 'add' | 'list' | 'update' | 'sync' | 'set_branch',
  opts: {
    url?: string;
    path?: string;
    branch?: string;
    recursive: boolean;
    remote: boolean;
    depth?: number;
    jobs?: number;
    paths?: string[];
  },
  repoPath: string,
): SubmoduleArgs {
  return SUBMODULE_BUILDERS[action](opts, repoPath);
}

const SUBMODULE_BUILDERS: Record<
  'add' | 'list' | 'update' | 'sync' | 'set_branch',
  (
    opts: {
      url?: string;
      path?: string;
      branch?: string;
      recursive: boolean;
      remote: boolean;
      depth?: number;
      jobs?: number;
      paths?: string[];
    },
    repoPath: string,
  ) => SubmoduleArgs
> = {
  list: () => ({ args: ['submodule', 'status'], fallback: 'No submodules.' }),
  sync: opts => {
    const args = ['submodule', 'sync'];
    if (opts.recursive) args.push('--recursive');
    return { args, fallback: 'Submodule sync complete.' };
  },
  update: (opts, repoPath) => {
    const args = ['submodule', 'update', '--init'];
    if (opts.recursive) args.push('--recursive');
    if (opts.remote) args.push('--remote');
    if (opts.depth !== undefined) args.push('--depth', String(opts.depth));
    if (opts.jobs !== undefined) args.push('--jobs', String(opts.jobs));
    if (opts.paths && opts.paths.length > 0) args.push('--', ...validatePathArguments(repoPath, opts.paths));
    return { args, fallback: 'Submodule update complete.' };
  },
  set_branch: (opts, repoPath) => {
    if (!opts.branch || !opts.path) throw new Error('branch and path are required for submodule set_branch.');
    const [safePath] = validatePathArguments(repoPath, [opts.path]);
    return {
      args: ['submodule', 'set-branch', '--branch', opts.branch, '--', safePath],
      fallback: `Set submodule ${safePath} branch to ${opts.branch}.`,
    };
  },
  add: (opts, repoPath) => {
    if (!opts.url || !opts.path) throw new Error('url and path are required for submodule add.');
    const [safePath] = validatePathArguments(repoPath, [opts.path]);
    return { args: ['submodule', 'add', opts.url, safePath], fallback: `Added submodule ${safePath}.` };
  },
};

/** Shared submodule tool. */
function registerGitSubmoduleTool(server: McpServer): void {
  server.registerTool(
    'git_submodule',
    {
      title: 'Git Submodule',
      description: 'Submodule: add, list, update, sync, or set_branch.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'list', 'update', 'sync', 'set_branch']).default('list'),
        url: z.string().optional(),
        path: z.string().optional(),
        branch: z.string().optional(),
        recursive: z.boolean().default(true),
        remote: z.boolean().default(false),
        depth: z.number().int().min(1).optional(),
        jobs: z.number().int().min(1).optional(),
        paths: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      url,
      path,
      branch,
      recursive,
      remote,
      depth,
      jobs,
      paths,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'list' | 'update' | 'sync' | 'set_branch';
      url?: string;
      path?: string;
      branch?: string;
      recursive: boolean;
      remote: boolean;
      depth?: number;
      jobs?: number;
      paths?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const { args, fallback } = buildSubmoduleArgs(
          action,
          { url, path, branch, recursive, remote, depth, jobs, paths },
          repoPath,
        );
        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || fallback;
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

export function registerWorkspaceTools(server: McpServer): void {
  registerGitStashTool(server);
  registerGitRebaseTool(server);
  registerGitCherryPickTool(server);
  registerGitMergeTool(server);
  registerGitBisectTool(server);
  registerGitTagTool(server);
  registerGitWorktreeTool(server);
  registerGitSubmoduleTool(server);
}
