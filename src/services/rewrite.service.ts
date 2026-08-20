import { getGit } from '../git/client.js';

export interface RewordOptions {
  readonly ref?: string;
  readonly message: string;
}

export interface SquashOptions {
  readonly count: number;
  readonly message: string;
}

export interface RewriteMessagesOptions {
  readonly range: string;
  /** Map of commit SHA (short or full) → replacement message. */
  readonly messages: Record<string, string>;
}

export interface BackupOptions {
  readonly name: string;
}

export interface RestoreOptions {
  readonly name: string;
}

const BACKUP_PREFIX = 'rewrite-backup/';

/**
 * Rewrites the message of a single commit. HEAD is amended in place; an
 * arbitrary commit is rewritten with `git filter-branch --msg-filter`.
 */
export async function rewordCommit(repoPath: string, options: RewordOptions): Promise<string> {
  const git = getGit(repoPath);

  if (!options.ref || options.ref === 'HEAD') {
    await git.raw(['commit', '--amend', '-m', options.message]);
    return `Reworded HEAD to: ${options.message}`;
  }

  // Rewrite only the target commit's message via filter-branch.
  const filter = `if [ "$GIT_COMMIT" = "${options.ref}" ]; then echo ${JSON.stringify(options.message)}; else cat; fi`;
  await git.raw(['filter-branch', '--force', '--msg-filter', filter, '--', 'HEAD']);
  return `Reworded ${options.ref} to: ${options.message}`;
}

/**
 * Squashes the last `count` commits into a single commit with the given message.
 * Uses `git reset --soft` + `git commit`, which is non-interactive and safe.
 */
export async function squashCommits(repoPath: string, options: SquashOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.count < 2) {
    throw new Error('count must be at least 2 to squash commits.');
  }

  await git.raw(['reset', '--soft', `HEAD~${options.count}`]);
  await git.raw(['commit', '-m', options.message]);
  return `Squashed last ${options.count} commits into: ${options.message}`;
}

/**
 * Rewrites commit messages across a range using an explicit SHA→message mapping.
 * Commits not present in the mapping keep their original message.
 */
export async function rewriteMessages(repoPath: string, options: RewriteMessagesOptions): Promise<string> {
  const git = getGit(repoPath);

  const entries = Object.entries(options.messages);
  if (entries.length === 0) {
    throw new Error('messages mapping must not be empty.');
  }

  // Build a msg-filter that replaces the message for each mapped commit and
  // passes through the original message for unmapped commits.
  const branches = entries.map(
    ([sha, message]) => `if [ "$GIT_COMMIT" = "${sha}" ]; then echo ${JSON.stringify(message)}; `,
  );
  const filter = `${branches.join('elif ')}else cat; fi`;

  await git.raw(['filter-branch', '--force', '--msg-filter', filter, '--', options.range]);
  return `Rewrote messages for ${entries.length} commit(s) in ${options.range}.`;
}

/**
 * Creates a backup branch at the current HEAD so a history rewrite can be
 * rolled back. Backup branches are named `rewrite-backup/<name>`.
 */
export async function createBackup(repoPath: string, options: BackupOptions): Promise<string> {
  const git = getGit(repoPath);
  const branchName = `${BACKUP_PREFIX}${options.name}`;

  await git.raw(['branch', branchName]);
  return `Created backup branch ${branchName}.`;
}

/**
 * Restores the repository to a previously created backup branch.
 */
export async function restoreBackup(repoPath: string, options: RestoreOptions): Promise<string> {
  const git = getGit(repoPath);
  const branchName = `${BACKUP_PREFIX}${options.name}`;

  await git.raw(['reset', '--hard', branchName]);
  return `Restored to backup branch ${branchName}.`;
}
