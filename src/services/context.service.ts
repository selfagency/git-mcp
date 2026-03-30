import { existsSync } from 'node:fs';
import path from 'node:path';
import { CHARACTER_LIMIT } from '../constants.js';
import { getGit } from '../git/client.js';
import { getLog, getStatus } from './inspect.service.js';

export interface ContextSummary {
  readonly branch: string;
  readonly ahead: number;
  readonly behind: number;
  readonly isClean: boolean;
  readonly changedFiles: number;
  readonly recentCommits: Array<{ hash: string; subject: string; dateIso: string }>;
  readonly remotes: string[];
  readonly inProgress: {
    rebasing: boolean;
    merging: boolean;
    cherryPicking: boolean;
    bisecting: boolean;
  };
}

export async function getContextSummary(repoPath: string): Promise<ContextSummary> {
  const git = getGit(repoPath);
  const [status, commits, remotesRaw, gitDir] = await Promise.all([
    getStatus(repoPath),
    getLog(repoPath, { limit: 5, offset: 0 }),
    git.getRemotes(false),
    git.raw(['rev-parse', '--absolute-git-dir']).then(s => s.trim()),
  ]);

  const rebasing = existsSync(path.join(gitDir, 'rebase-merge')) || existsSync(path.join(gitDir, 'rebase-apply'));
  const merging = existsSync(path.join(gitDir, 'MERGE_HEAD'));
  const cherryPicking = existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'));
  const bisecting = existsSync(path.join(gitDir, 'BISECT_LOG'));

  return {
    branch: status.current,
    ahead: status.ahead,
    behind: status.behind,
    isClean: status.isClean,
    changedFiles: status.files.length,
    recentCommits: commits.map(commit => ({
      hash: commit.hash,
      subject: commit.subject,
      dateIso: commit.dateIso,
    })),
    remotes: remotesRaw.map(remote => remote.name),
    inProgress: {
      rebasing,
      merging,
      cherryPicking,
      bisecting,
    },
  };
}

export async function searchHistory(repoPath: string, query: string, limit: number): Promise<string> {
  const git = getGit(repoPath);

  const [pickaxe, grep] = await Promise.all([
    git.raw(['log', '-S', query, '--oneline', '-n', String(limit)]),
    git.raw(['grep', '-n', '-m', String(limit), '--', query]).catch(() => ''),
  ]);

  const sections = [
    '## Pickaxe (-S)',
    pickaxe.trim() || 'No history matches.',
    '',
    '## grep',
    grep.trim() || 'No working-tree matches.',
  ];

  const combined = sections.join('\n');
  return combined.length > CHARACTER_LIMIT
    ? `${combined.slice(0, CHARACTER_LIMIT)}\n\n[Output truncated at ${CHARACTER_LIMIT} characters]`
    : combined;
}

const BLOCKED_CONFIG_KEY_PATTERNS: readonly RegExp[] = [/^credential\./i, /^url\./i];

const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [/(password|token|secret|auth|passphrase)/i];

function isBlockedConfigKey(key: string): boolean {
  return BLOCKED_CONFIG_KEY_PATTERNS.some(p => p.test(key));
}

function redactConfigValue(key: string, value: string): string {
  if (SENSITIVE_KEY_PATTERNS.some(p => p.test(key))) {
    return '***';
  }
  // Redact credentials embedded in URLs: https://user:pass@host → https://***@host
  const stripped = value.replace(/(https?:\/\/)[^@\s]+@/g, '$1***@');
  // Redact long hex strings that look like access tokens (not normal in config values)
  if (/\b[0-9a-f]{40,}\b/i.test(stripped)) {
    return '***';
  }
  return stripped;
}

export async function getConfig(repoPath: string, key?: string): Promise<string> {
  const git = getGit(repoPath);

  if (key) {
    if (isBlockedConfigKey(key)) {
      throw new Error(`Access to git config key '${key}' is not permitted.`);
    }
    const value = await git.raw(['config', '--get', key]);
    return redactConfigValue(key, value.trim());
  }

  const output = await git.raw(['config', '--list']);
  const lines = output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      const eq = line.indexOf('=');
      if (eq === -1) return [];
      const k = line.slice(0, eq);
      const v = line.slice(eq + 1);
      if (isBlockedConfigKey(k)) return [];
      return [`${k}=${redactConfigValue(k, v)}`];
    });

  return lines.join('\n').trim();
}

export async function setConfig(repoPath: string, key: string, value: string): Promise<string> {
  const git = getGit(repoPath);
  await git.raw(['config', key, value]);
  return `Set ${key}.`;
}
