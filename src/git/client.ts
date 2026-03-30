import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type { GitError, GitErrorKind } from '../types.js';

const GIT_NOT_FOUND_PATTERN = /(not found|is not recognized|ENOENT)/i;
const PERMISSION_PATTERN = /(permission denied|EACCES|EPERM)/i;
const CONFLICT_PATTERN = /(CONFLICT|merge conflict|rebase in progress|cherry-pick in progress)/i;
const NETWORK_PATTERN = /(network|timed out|unable to access|could not resolve host|proxy)/i;

function classifyError(message: string): GitErrorKind {
  if (GIT_NOT_FOUND_PATTERN.test(message)) {
    return 'missing_git';
  }

  if (PERMISSION_PATTERN.test(message)) {
    return 'permission';
  }

  if (CONFLICT_PATTERN.test(message)) {
    return 'git_conflict';
  }

  if (NETWORK_PATTERN.test(message)) {
    return 'network';
  }

  return 'unknown';
}

export function toGitError(error: unknown): GitError {
  if (error instanceof Error) {
    return {
      kind: classifyError(error.message),
      message: error.message,
    };
  }

  return {
    kind: 'unknown',
    message: String(error),
  };
}

export function validateRepoPath(repoPath: string): string {
  const resolved = path.resolve(repoPath);

  if (!existsSync(resolved)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Repository path is not a directory: ${repoPath}`);
  }

  return resolved;
}

export function getGit(repoPath: string): SimpleGit {
  const safePath = validateRepoPath(repoPath);
  return simpleGit({ baseDir: safePath, binary: 'git', maxConcurrentProcesses: 6 });
}
