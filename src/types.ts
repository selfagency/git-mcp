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
