export type GitErrorKind =
  | 'invalid_input'
  | 'repository_state'
  | 'permission'
  | 'missing_git'
  | 'git_conflict'
  | 'network'
  | 'unsupported'
  | 'unknown';

export interface GitError {
  readonly kind: GitErrorKind;
  readonly message: string;
}

export interface CommitInfo {
  readonly hash: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly dateIso: string;
  readonly subject: string;
}

export interface FileStatus {
  readonly path: string;
  readonly index: string;
  readonly workingTree: string;
}

export interface BranchInfo {
  readonly name: string;
  readonly isCurrent: boolean;
  readonly commit?: string;
  readonly upstream?: string;
}

export interface RemoteInfo {
  readonly name: string;
  readonly fetchUrl?: string;
  readonly pushUrl?: string;
}

export interface DiffSummary {
  readonly filesChanged: number;
  readonly insertions: number;
  readonly deletions: number;
}

export interface StashEntry {
  readonly index: number;
  readonly ref: string;
  readonly branch: string;
  readonly message: string;
}

export interface WorktreeInfo {
  readonly path: string;
  readonly head: string;
  readonly branch?: string;
  readonly isBare: boolean;
  readonly isDetached: boolean;
}

export type FlowBranchKind = 'base' | 'topic';

export type FlowMergeStrategy = 'merge' | 'rebase' | 'squash' | 'none';

export type FlowOperation = 'init' | 'overview' | 'config' | 'topic' | 'control';

export type FlowPreset = 'classic' | 'github' | 'gitlab';

export type FlowScope = 'local' | 'global' | 'system' | 'file';

export type FlowConfigAction = 'list' | 'add' | 'update' | 'rename' | 'delete' | 'status' | 'sync';

export type FlowTopicAction =
  | 'start'
  | 'finish'
  | 'publish'
  | 'list'
  | 'update'
  | 'delete'
  | 'rename'
  | 'checkout'
  | 'track';

export type FlowControlAction = 'continue' | 'abort';

export type FlowMatchMode = 'exact' | 'prefix';

export type WorkflowName = 'snapshot' | 'replay' | 'branch_surgery' | 'publish';

export type WorkflowLifecycleAction = 'start' | 'status' | 'continue' | 'abort' | 'list';

export type WorkflowExecutionStatus = 'running' | 'paused' | 'completed' | 'failed' | 'aborted';

export type WorkflowStepStatus = 'pending' | 'completed' | 'failed';

export interface WorkflowStepResult {
  readonly index: number;
  readonly name: string;
  readonly status: WorkflowStepStatus;
  readonly output?: string;
  readonly error?: string;
}

export interface WorkflowStepResumeConfig {
  readonly continueArgs: readonly string[];
  readonly abortArgs?: readonly string[];
}

export interface WorkflowStepDefinition {
  readonly kind: 'gitRaw';
  readonly name: string;
  readonly args: readonly string[];
  readonly readOnly: boolean;
  readonly destructive?: boolean;
  readonly openWorld?: boolean;
  readonly resumable?: WorkflowStepResumeConfig;
}

export interface WorkflowDefinition {
  readonly workflow: WorkflowName;
  readonly steps: readonly WorkflowStepDefinition[];
  readonly params: Readonly<Record<string, unknown>>;
}

export interface WorkflowState {
  readonly id: string;
  readonly workflow: WorkflowName;
  readonly status: WorkflowExecutionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currentStep: number;
  readonly steps: readonly WorkflowStepResult[];
  readonly pauseReason?: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** Schema version for forward/backward compatibility. */
  readonly version: number;
  /** Repository identity (remote URL + HEAD SHA) to prevent cross-repo state leakage. */
  readonly repoIdentity: string;
}
