import { existsSync } from 'node:fs';
import path from 'node:path';
import { getGit } from '../git/client.js';

/**
 * Centralized preflight checks for destructive Git operations. Every mutating
 * tool should call the relevant assertions before acting to prevent silent
 * repository corruption or data loss.
 */

export async function assertCleanWorktree(repoPath: string): Promise<void> {
  const git = getGit(repoPath);
  const status = await git.status();
  if (!status.isClean()) {
    throw new Error('Working tree is not clean. Commit or stash changes before this operation.');
  }
}

export async function assertNotDetached(repoPath: string): Promise<void> {
  const git = getGit(repoPath);
  try {
    await git.raw(['symbolic-ref', 'HEAD']);
  } catch {
    throw new Error('Repository is in detached HEAD state. Checkout a branch before this operation.');
  }
}

export async function assertNoInProgressOperation(repoPath: string): Promise<void> {
  const git = getGit(repoPath);
  const gitDir = await git.revparse(['--git-dir']);
  const markers = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'BISECT_LOG'];
  for (const marker of markers) {
    if (existsSync(path.join(gitDir, marker))) {
      throw new Error(
        `A ${marker.replace('_HEAD', '').replace('-merge', '').replace('-apply', '')} operation is in progress. Resolve or abort it first.`,
      );
    }
  }
}

export async function assertValidRef(repoPath: string, ref: string): Promise<void> {
  const git = getGit(repoPath);
  try {
    await git.revparse(['--verify', `${ref}^{commit}`]);
  } catch {
    throw new Error(`Invalid ref: ${ref}`);
  }
}

export async function assertBackupBranchAvailable(repoPath: string, name: string): Promise<void> {
  const git = getGit(repoPath);
  const branches = await git.branch(['--list', name]);
  if (branches.all.includes(name)) {
    throw new Error(`Backup branch ${name} already exists. Choose a different name.`);
  }
}

export async function assertNotConcurrent(repoPath: string, operation: string): Promise<void> {
  const git = getGit(repoPath);
  const gitDir = await git.revparse(['--git-dir']);
  const lockFile = path.join(gitDir, `git-mcp-${operation}.lock`);
  if (existsSync(lockFile)) {
    throw new Error(`Another ${operation} operation is already in progress.`);
  }
}
