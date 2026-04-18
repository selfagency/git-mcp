import { ALLOW_NO_VERIFY, AUTO_SIGN_COMMITS, DEFAULT_SIGNING_KEY } from '../config.js';
import { getGit, validatePathArguments } from '../git/client.js';

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
  /** Sign the commit. Defaults to AUTO_SIGN_COMMITS server config. */
  readonly sign?: boolean;
  /** Signing key to use. Falls back to DEFAULT_SIGNING_KEY, then git's user.signingkey. */
  readonly signingKey?: string;
  /** Pass --no-verify to bypass pre-commit/commit-msg hooks. Requires ALLOW_NO_VERIFY=true. */
  readonly noVerify?: boolean;
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

  const safePaths = validatePathArguments(repoPath, paths);
  await git.add(safePaths);
  return `Staged ${safePaths.length} path(s).`;
}

export async function restoreFiles(repoPath: string, options: GitRestoreOptions): Promise<string> {
  const git = getGit(repoPath);
  const safePaths = validatePathArguments(repoPath, options.paths);

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

  args.push('--', ...safePaths);

  await git.raw(args);
  return `Restored ${safePaths.length} path(s).`;
}

export async function commitChanges(repoPath: string, options: GitCommitOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.noVerify && !ALLOW_NO_VERIFY) {
    throw new Error(
      'no_verify is disabled on this server. Set GIT_ALLOW_NO_VERIFY=true to permit bypassing git hooks.',
    );
  }

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
  if (options.noVerify) {
    args.push('--no-verify');
  }

  const shouldSign = options.sign ?? AUTO_SIGN_COMMITS;
  if (shouldSign) {
    const key = options.signingKey ?? DEFAULT_SIGNING_KEY;
    args.push(key ? `--gpg-sign=${key}` : '--gpg-sign');
  }

  // simple-git expects message, then options array (as second arg), not third
  const result = await git.commit(options.message, args);
  return `Committed ${result.commit}.`;
}

export async function resetChanges(repoPath: string, options: GitResetOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.paths && options.paths.length > 0) {
    const safePaths = validatePathArguments(repoPath, options.paths);
    const args = ['reset'];
    if (options.target) {
      args.push(options.target);
    }
    args.push('--', ...safePaths);
    await git.raw(args);
    return `Unstaged ${safePaths.length} path(s).`;
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
