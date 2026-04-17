import path from 'node:path';
import { CHARACTER_LIMIT, EXCLUDED_DIFF_DIRECTORIES, EXCLUDED_DIFF_EXTENSIONS } from '../constants.js';
import { getGit, validatePathArgument } from '../git/client.js';
import type { CommitInfo, DiffSummary, FileStatus } from '../types.js';

export interface GitStatusResult {
  readonly branch: string;
  readonly current: string;
  readonly tracking: string;
  readonly ahead: number;
  readonly behind: number;
  readonly files: FileStatus[];
  readonly isClean: boolean;
}

export interface GitLogOptions {
  readonly limit: number;
  readonly offset: number;
  readonly author?: string;
  readonly grep?: string;
  readonly since?: string;
  readonly until?: string;
  readonly filePath?: string;
}

export interface GitDiffOptions {
  readonly mode: 'unstaged' | 'staged' | 'refs';
  readonly fromRef?: string;
  readonly toRef?: string;
  readonly filtered: boolean;
}

function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }

  return `${text.slice(0, CHARACTER_LIMIT)}\n\n[truncated to ${CHARACTER_LIMIT} characters]`;
}

export function parseCommitLogLine(line: string): CommitInfo | null {
  const [hash, authorName, authorEmail, dateIso, ...subjectParts] = line.split('\t');
  if (!hash || !authorName || !authorEmail || !dateIso) {
    return null;
  }

  return {
    hash,
    authorName,
    authorEmail,
    dateIso,
    subject: subjectParts.join('\t'),
  };
}

function shouldExcludeFile(filePath: string): boolean {
  if (EXCLUDED_DIFF_DIRECTORIES.some(prefix => filePath.startsWith(prefix))) {
    return true;
  }

  const extension = path.extname(filePath).replace(/^\./, '').toLowerCase();
  if (!extension) {
    return false;
  }

  return EXCLUDED_DIFF_EXTENSIONS.includes(extension as (typeof EXCLUDED_DIFF_EXTENSIONS)[number]);
}

function buildDiffBaseArgs(options: GitDiffOptions): string[] {
  if (options.mode === 'staged') {
    return ['diff', '--staged'];
  }

  if (options.mode === 'refs') {
    if (!options.fromRef || !options.toRef) {
      throw new Error("from_ref and to_ref are required when mode='refs'");
    }

    return ['diff', `${options.fromRef}..${options.toRef}`];
  }

  return ['diff'];
}

export async function getStatus(repoPath: string): Promise<GitStatusResult> {
  const git = getGit(repoPath);
  const status = await git.status();

  const files: FileStatus[] = status.files.map(file => ({
    path: file.path,
    index: file.index,
    workingTree: file.working_dir,
  }));

  return {
    branch: status.current ?? '',
    current: status.current ?? '',
    tracking: status.tracking ?? '',
    ahead: status.ahead,
    behind: status.behind,
    files,
    isClean: status.isClean(),
  };
}

export async function getLog(repoPath: string, options: GitLogOptions): Promise<CommitInfo[]> {
  const git = getGit(repoPath);

  const args = [
    'log',
    '--date=iso-strict',
    `--skip=${options.offset}`,
    '-n',
    String(options.limit),
    '--pretty=format:%H%x09%an%x09%ae%x09%aI%x09%s',
  ];

  if (options.author) {
    args.push(`--author=${options.author}`);
  }

  if (options.grep) {
    args.push(`--grep=${options.grep}`);
  }

  if (options.since) {
    args.push(`--since=${options.since}`);
  }

  if (options.until) {
    args.push(`--until=${options.until}`);
  }

  if (options.filePath) {
    args.push('--', validatePathArgument(repoPath, options.filePath));
  }

  const output = await git.raw(args);

  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(parseCommitLogLine)
    .filter((item): item is CommitInfo => item !== null);
}

export async function showRef(repoPath: string, ref: string): Promise<string> {
  const git = getGit(repoPath);
  const output = await git.raw(['show', '--stat', '--patch', ref]);
  return truncate(output);
}

export async function getDiffSummary(repoPath: string, options: GitDiffOptions): Promise<DiffSummary> {
  const git = getGit(repoPath);
  const baseArgs = buildDiffBaseArgs(options).slice(1);
  const summary = await git.diffSummary(baseArgs);

  return {
    filesChanged: summary.files.length,
    insertions: summary.insertions,
    deletions: summary.deletions,
  };
}

export async function getDiff(repoPath: string, options: GitDiffOptions): Promise<string> {
  const git = getGit(repoPath);
  const baseArgs = buildDiffBaseArgs(options);

  if (!options.filtered) {
    const output = await git.raw(baseArgs);
    return truncate(output);
  }

  const namesOutput = await git.raw([...baseArgs, '--name-only']);
  const files = namesOutput
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !shouldExcludeFile(line));

  if (files.length === 0) {
    return 'No changed files after filtering.';
  }

  const chunks: string[] = [];
  for (const filePath of files) {
    const diff = await git.raw([...baseArgs, '--', filePath]);
    chunks.push(`=== ${filePath} ===\n${diff.trim()}`);
  }

  return truncate(chunks.join('\n\n'));
}

export async function blameFile(repoPath: string, filePath: string, ref?: string): Promise<string> {
  const git = getGit(repoPath);
  const safeFilePath = validatePathArgument(repoPath, filePath);

  const args = ['blame'];
  if (ref) {
    args.push(ref);
  }
  args.push('--', safeFilePath);

  const output = await git.raw(args);
  return truncate(output);
}

export async function getReflog(repoPath: string, limit: number): Promise<string> {
  const git = getGit(repoPath);
  const output = await git.raw(['reflog', '--date=iso', '-n', String(limit)]);
  return truncate(output);
}
