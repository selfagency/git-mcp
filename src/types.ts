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

export type FlowHealthStatus = 'healthy' | 'warning' | 'error';

export type FlowMergeStrategy = 'merge' | 'rebase' | 'squash' | 'none';

export type FlowConfigAction = 'list' | 'add' | 'update' | 'rename' | 'delete';

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

export type FlowFinishStage =
  | 'prepare'
  | 'hook-pre-finish'
  | 'filter-version'
  | 'checkout-parent'
  | 'integrate-parent'
  | 'tag'
  | 'hook-post-parent'
  | 'checkout-backmerge'
  | 'integrate-backmerge'
  | 'hook-post-finish'
  | 'publish'
  | 'cleanup';

export type FlowHookPhase =
  | 'pre-start'
  | 'post-start'
  | 'pre-finish'
  | 'post-finish'
  | 'pre-publish'
  | 'post-publish'
  | 'pre-track'
  | 'post-track'
  | 'pre-delete'
  | 'post-delete'
  | 'pre-update'
  | 'post-update';

export type FlowFilterKind = 'version' | 'tag_message';

export interface FlowBranchDefinition {
  readonly name: string;
  readonly kind: FlowBranchKind;
  readonly parent?: string;
  readonly prefix?: string;
  readonly startPoint?: string;
  readonly upstreamStrategy?: FlowMergeStrategy;
  readonly downstreamStrategy?: FlowMergeStrategy;
  readonly tag?: boolean;
  readonly tagPrefix?: string;
  readonly autoUpdate?: boolean;
  readonly forceDelete?: boolean;
  readonly source: 'structured' | 'legacy';
}

export interface FlowActiveBranch {
  readonly type: string;
  readonly fullName: string;
  readonly shortName: string;
  readonly isCurrent: boolean;
  readonly upstream?: string;
  readonly tracking?: string;
}

export interface FlowOverview {
  readonly initialized: boolean;
  readonly version?: string;
  readonly compatibility: 'structured' | 'legacy' | 'unconfigured';
  readonly bases: readonly FlowBranchDefinition[];
  readonly topics: readonly FlowBranchDefinition[];
  readonly activeBranches: readonly FlowActiveBranch[];
  readonly currentBranch?: string;
  readonly ahead?: number;
  readonly behind?: number;
  readonly health: {
    readonly status: FlowHealthStatus;
    readonly issues: readonly string[];
  };
}

export interface FlowConfigMutationResult {
  readonly action: FlowConfigAction;
  readonly branch: FlowBranchDefinition;
  readonly previousName?: string;
}

export interface FlowTopicSelection {
  readonly topic: string;
  readonly fullName: string;
  readonly shortName: string;
}

export interface FlowHookExecutionResult {
  readonly phase: FlowHookPhase;
  readonly hookPath?: string;
  readonly executed: boolean;
  readonly skippedReason?: string;
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface FlowFilterExecutionResult {
  readonly kind: FlowFilterKind;
  readonly command?: string;
  readonly executed: boolean;
  readonly skippedReason?: string;
  readonly input: string;
  readonly output: string;
}

export interface FlowFinishState {
  readonly topic: string;
  readonly shortName: string;
  readonly branchName: string;
  readonly originalBranch: string;
  readonly parentBranch: string;
  readonly backmergeBranches: readonly string[];
  readonly stage: FlowFinishStage;
  readonly strategy: FlowMergeStrategy;
  readonly deleteBranch: boolean;
  readonly keepBranch: boolean;
  readonly tagName?: string;
  readonly tagMessage?: string;
  readonly remote?: string;
  readonly pendingBackmergeIndex: number;
  readonly publishAfterFinish: boolean;
}

export interface FlowFinishResult {
  readonly completed: boolean;
  readonly state?: FlowFinishState;
  readonly mergedInto: readonly string[];
  readonly deleted: boolean;
  readonly tagName?: string;
  readonly hooks: readonly FlowHookExecutionResult[];
  readonly filters: readonly FlowFilterExecutionResult[];
}
