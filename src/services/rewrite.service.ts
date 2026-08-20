import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getGit } from '../git/client.js';
import { assertCleanWorktree, assertNoInProgressOperation, assertNotDetached } from './preflight.js';

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
 * Creates a temp directory and returns a cleanup function. Used to stage
 * commit messages on disk so they never appear in a shell command string.
 */
function makeTempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'git-mcp-rewrite-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Rewrites the message of a single commit. HEAD is amended in place; an
 * arbitrary commit is rewritten with `git filter-branch --msg-filter` that
 * reads the replacement message from a temp file (never embedded in the shell
 * string), preventing shell injection via commit-message content.
 */
export async function rewordCommit(repoPath: string, options: RewordOptions): Promise<string> {
  const git = getGit(repoPath);

  if (!options.ref || options.ref === 'HEAD') {
    await git.raw(['commit', '--amend', '-m', options.message]);
    return `Reworded HEAD to: ${options.message}`;
  }

  await assertCleanWorktree(repoPath);
  await assertNotDetached(repoPath);
  await assertNoInProgressOperation(repoPath);

  const { dir, cleanup } = makeTempDir();
  try {
    const msgFile = path.join(dir, 'message.txt');
    writeFileSync(msgFile, options.message, 'utf8');

    // The filter script references only fixed paths — never user message
    // content — so shell metacharacters in the message cannot execute.
    const filter = `if [ "$GIT_COMMIT" = "${options.ref}" ]; then cat "${msgFile}"; else cat; fi`;
    await git.raw(['filter-branch', '--force', '--msg-filter', filter, '--', 'HEAD']);
    return `Reworded ${options.ref} to: ${options.message}`;
  } finally {
    cleanup();
  }
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

  await assertCleanWorktree(repoPath);
  await assertNotDetached(repoPath);
  await assertNoInProgressOperation(repoPath);

  await git.raw(['reset', '--soft', `HEAD~${options.count}`]);
  await git.raw(['commit', '-m', options.message]);
  return `Squashed last ${options.count} commits into: ${options.message}`;
}

/**
 * Rewrites commit messages across a range using an explicit SHA→message mapping.
 * Commits not present in the mapping keep their original message. Messages are
 * staged in a temp file and read by the filter, never embedded in the shell
 * command string.
 */
export async function rewriteMessages(repoPath: string, options: RewriteMessagesOptions): Promise<string> {
  const git = getGit(repoPath);

  const entries = Object.entries(options.messages);
  if (entries.length === 0) {
    throw new Error('messages mapping must not be empty.');
  }

  await assertCleanWorktree(repoPath);
  await assertNotDetached(repoPath);
  await assertNoInProgressOperation(repoPath);

  const { dir, cleanup } = makeTempDir();
  try {
    // Map file: one "<sha> <message>" per line. The filter greps by $GIT_COMMIT
    // and prints the message; the message content lives in the file, not the
    // shell string.
    const mapFile = path.join(dir, 'messages.txt');
    writeFileSync(mapFile, entries.map(([sha, message]) => `${sha} ${message}`).join('\n'), 'utf8');

    const filter = `line=$(grep "^$GIT_COMMIT " "${mapFile}"); if [ -n "$line" ]; then printf '%s' "\${line#* }"; else cat; fi`;
    await git.raw(['filter-branch', '--force', '--msg-filter', filter, '--', options.range]);
    return `Rewrote messages for ${entries.length} commit(s) in ${options.range}.`;
  } finally {
    cleanup();
  }
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

  await assertCleanWorktree(repoPath);
  await assertNoInProgressOperation(repoPath);

  await git.raw(['reset', '--hard', branchName]);
  return `Restored to backup branch ${branchName}.`;
}
