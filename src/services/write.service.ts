import { getGit } from '../git/client.js';

export interface GitAddOptions {
  readonly all?: boolean;
  readonly paths?: string[];
}

export interface GitRestoreOptions {
  readonly paths: string[];
  readonly staged: boolean;
  readonly worktree: boolean;
  readonly source?: string;
}

export interface GitCommitOptions {
  readonly message: string;
  readonly all: boolean;
  readonly amend: boolean;
  readonly noEdit: boolean;
}

export interface GitResetOptions {
  readonly mode: 'soft' | 'mixed' | 'hard';
  readonly target?: string;
  readonly paths?: string[];
}

export interface GitRevertOptions {
  readonly ref: string;
  readonly noCommit: boolean;
  readonly mainline?: number;
}

export async function addFiles(repoPath: string, options: GitAddOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.all) {
    await git.add('.');
    return 'Staged all changes.';
  }

  const paths = options.paths ?? [];
  if (paths.length === 0) {
    throw new Error('Provide paths or set all=true.');
  }

  await git.add(paths);
  return `Staged ${paths.length} path(s).`;
}

export async function restoreFiles(repoPath: string, options: GitRestoreOptions): Promise<string> {
  const git = getGit(repoPath);

  if (!options.staged && !options.worktree) {
    throw new Error('At least one of staged/worktree must be true.');
  }

  const args = ['restore'];

  if (options.staged) {
    args.push('--staged');
  }

  if (options.worktree) {
    args.push('--worktree');
  }

  if (options.source) {
    args.push('--source', options.source);
  }

  args.push('--', ...options.paths);

  await git.raw(args);
  return `Restored ${options.paths.length} path(s).`;
}

export async function commitChanges(repoPath: string, options: GitCommitOptions): Promise<string> {
  const git = getGit(repoPath);

  const args: string[] = [];
  if (options.all) {
    args.push('-a');
  }

  if (options.amend) {
    args.push('--amend');
  }

  if (options.noEdit) {
    args.push('--no-edit');
  }

  const result = await git.commit(options.message, undefined, args);
  return `Committed ${result.commit}.`;
}

export async function resetChanges(repoPath: string, options: GitResetOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.paths && options.paths.length > 0) {
    const args = ['reset'];
    if (options.target) {
      args.push(options.target);
    }
    args.push('--', ...options.paths);
    await git.raw(args);
    return `Unstaged ${options.paths.length} path(s).`;
  }

  const args = ['reset', `--${options.mode}`];
  if (options.target) {
    args.push(options.target);
  }

  await git.raw(args);
  return `Reset completed with mode=${options.mode}.`;
}

export async function revertCommit(repoPath: string, options: GitRevertOptions): Promise<string> {
  const git = getGit(repoPath);

  const args = ['revert'];
  if (options.noCommit) {
    args.push('--no-commit');
  }

  if (typeof options.mainline === 'number') {
    args.push('-m', String(options.mainline));
  }

  args.push(options.ref);

  await git.raw(args);
  return `Reverted ${options.ref}.`;
}
