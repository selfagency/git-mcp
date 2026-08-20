import { getGit } from '../git/client.js';

export interface ContributorStats {
  name: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstActivity: string;
  lastActivity: string;
}

export interface ChurnEntry {
  file: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface ActivityEntry {
  readonly period: string;
  readonly commits: number;
}

export interface RepoSummary {
  readonly branchCount: number;
  readonly tagCount: number;
  readonly totalCommits: number;
  readonly topContributors: ContributorStats[];
  readonly oldestCommit: string;
  readonly newestCommit: string;
}

export interface FileStatEntry {
  readonly extension: string;
  readonly count: number;
}

export interface FileStats {
  readonly byExtension: FileStatEntry[];
  readonly largestFiles: Array<{ path: string; bytes: number }>;
  readonly recentlyModified: string[];
}

interface LogEntry {
  readonly hash: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly dateIso: string;
  readonly additions: number;
  readonly deletions: number;
}

function parseLogEntry(line: string): LogEntry | null {
  const [hash, authorName, authorEmail, dateIso, additions, deletions] = line.split('\t');
  if (!hash || !authorName || !authorEmail || !dateIso) {
    return null;
  }
  return {
    hash,
    authorName,
    authorEmail,
    dateIso,
    additions: Number(additions) || 0,
    deletions: Number(deletions) || 0,
  };
}

async function getLogEntries(repoPath: string, limit = 1000): Promise<LogEntry[]> {
  const git = getGit(repoPath);
  const output = await git.raw([
    'log',
    '--pretty=format:%H\t%an\t%ae\t%aI',
    '--numstat',
    '--no-renames',
    '-n',
    String(limit),
  ]);
  return output
    .split('\n')
    .filter(line => line.includes('\t'))
    .map(parseLogEntry)
    .filter((entry): entry is LogEntry => entry !== null);
}

export async function getContributors(repoPath: string): Promise<ContributorStats[]> {
  const entries = await getLogEntries(repoPath);
  const byAuthor = new Map<string, ContributorStats>();

  for (const entry of entries) {
    const key = `${entry.authorName} <${entry.authorEmail}>`;
    const existing = byAuthor.get(key);
    if (existing) {
      existing.commits += 1;
      existing.additions += entry.additions;
      existing.deletions += entry.deletions;
      if (entry.dateIso < existing.firstActivity) existing.firstActivity = entry.dateIso;
      if (entry.dateIso > existing.lastActivity) existing.lastActivity = entry.dateIso;
    } else {
      byAuthor.set(key, {
        name: entry.authorName,
        email: entry.authorEmail,
        commits: 1,
        additions: entry.additions,
        deletions: entry.deletions,
        firstActivity: entry.dateIso,
        lastActivity: entry.dateIso,
      });
    }
  }

  return [...byAuthor.values()].sort((a, b) => b.commits - a.commits);
}

export async function getChurn(repoPath: string): Promise<ChurnEntry[]> {
  const git = getGit(repoPath);
  const output = await git.raw(['log', '--pretty=format:', '--numstat', '--no-renames']);
  const byFile = new Map<string, ChurnEntry>();

  for (const line of output.split('\n')) {
    const [additions, deletions, file] = line.split('\t');
    if (!file || additions === '-' || deletions === '-') continue;
    const existing = byFile.get(file);
    if (existing) {
      existing.commits += 1;
      existing.additions += Number(additions) || 0;
      existing.deletions += Number(deletions) || 0;
    } else {
      byFile.set(file, {
        file,
        commits: 1,
        additions: Number(additions) || 0,
        deletions: Number(deletions) || 0,
      });
    }
  }

  return [...byFile.values()].sort((a, b) => b.commits - a.commits).slice(0, 50);
}

export async function getActivity(repoPath: string): Promise<ActivityEntry[]> {
  const git = getGit(repoPath);
  const output = await git.raw(['log', '--pretty=format:%ad', '--date=short']);
  const byPeriod = new Map<string, number>();

  for (const date of output.split('\n')) {
    if (!date) continue;
    byPeriod.set(date, (byPeriod.get(date) ?? 0) + 1);
  }

  return [...byPeriod.entries()]
    .map(([period, commits]) => ({ period, commits }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function getRepoSummary(repoPath: string): Promise<RepoSummary> {
  const git = getGit(repoPath);
  const [branchCount, tagCount, totalCommits, oldest, newest] = await Promise.all([
    git.raw(['branch', '--list']).then(out => out.split('\n').filter(Boolean).length),
    git.raw(['tag', '--list']).then(out => out.split('\n').filter(Boolean).length),
    git.raw(['rev-list', '--count', 'HEAD']).then(out => Number(out.trim()) || 0),
    git.raw(['log', '--pretty=format:%aI', '--reverse']).then(out => out.split('\n')[0] ?? ''),
    git.raw(['log', '-1', '--pretty=format:%aI']).then(out => out.trim()),
  ]);

  const contributors = await getContributors(repoPath);

  return {
    branchCount,
    tagCount,
    totalCommits,
    topContributors: contributors.slice(0, 10),
    oldestCommit: oldest,
    newestCommit: newest,
  };
}

export async function getFileStats(repoPath: string): Promise<FileStats> {
  const git = getGit(repoPath);
  const byExtension = new Map<string, number>();
  const largest: Array<{ path: string; bytes: number }> = [];

  // Single subprocess: `git ls-tree -r -l HEAD` returns path + blob size for
  // every tracked file, avoiding the N+1 cat-file loop.
  const tree = await git.raw(['ls-tree', '-r', '-l', 'HEAD']);
  for (const line of tree.split('\n')) {
    if (!line) continue;
    // Format: <mode> <type> <sha> <size>\t<path>
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const meta = line.slice(0, tab).split(/\s+/);
    const file = line.slice(tab + 1);
    const bytes = Number(meta[3]) || 0;
    const ext = file.includes('.') ? file.slice(file.lastIndexOf('.') + 1) : '(none)';
    byExtension.set(ext, (byExtension.get(ext) ?? 0) + 1);
    largest.push({ path: file, bytes });
  }

  largest.sort((a, b) => b.bytes - a.bytes);

  const recentlyModified = await git
    .raw(['log', '-10', '--pretty=format:', '--name-only', '--no-renames'])
    .then(out => [...new Set(out.split('\n').filter(Boolean))]);

  return {
    byExtension: [...byExtension.entries()]
      .map(([extension, count]) => ({ extension, count }))
      .sort((a, b) => b.count - a.count),
    largestFiles: largest.slice(0, 20),
    recentlyModified,
  };
}
