import { getGit } from '../git/client.js';

export type LfsAction =
  | 'track'
  | 'untrack'
  | 'ls-files'
  | 'status'
  | 'pull'
  | 'push'
  | 'install'
  | 'migrate-import'
  | 'migrate-export';

export interface LfsOptions {
  readonly action: LfsAction;
  /** File patterns for track/untrack (e.g. "*.psd", "*.zip"). */
  readonly patterns?: string[];
  /** Remote name for pull/push operations. */
  readonly remote?: string;
  /** Comma-separated include patterns for migrate operations. */
  readonly include?: string;
  /** Comma-separated exclude patterns for migrate operations. */
  readonly exclude?: string;
  /** Pass --everything to migrate-import to rewrite all refs. */
  readonly everything?: boolean;
}

function buildIncludeExcludeArgs(options: Pick<LfsOptions, 'include' | 'exclude'>): string[] {
  const args: string[] = [];
  if (options.include) args.push('--include', options.include);
  if (options.exclude) args.push('--exclude', options.exclude);
  return args;
}

function ensurePatterns(options: LfsOptions, action: 'track' | 'untrack'): string[] {
  if (!options.patterns || options.patterns.length === 0) {
    throw new Error(`patterns is required for lfs ${action}.`);
  }
  return options.patterns;
}

function ensureRemote(options: LfsOptions, action: 'push'): string {
  if (!options.remote) {
    throw new Error(`remote is required for lfs ${action}.`);
  }
  return options.remote;
}

export async function runLfsAction(repoPath: string, options: LfsOptions): Promise<string> {
  const git = getGit(repoPath);

  switch (options.action) {
    case 'install': {
      const output = await git.raw(['lfs', 'install']);
      return output.trim() || 'Git LFS installed for this repository.';
    }

    case 'track': {
      const patterns = ensurePatterns(options, 'track');
      const output = await git.raw(['lfs', 'track', ...patterns]);
      return output.trim() || `Tracking: ${patterns.join(', ')}`;
    }

    case 'untrack': {
      const patterns = ensurePatterns(options, 'untrack');
      const output = await git.raw(['lfs', 'untrack', ...patterns]);
      return output.trim() || `Untracked: ${patterns.join(', ')}`;
    }

    case 'ls-files': {
      const output = await git.raw(['lfs', 'ls-files']);
      return output.trim() || 'No LFS-tracked files found.';
    }

    case 'status': {
      const output = await git.raw(['lfs', 'status']);
      return output.trim() || 'No LFS status changes.';
    }

    case 'pull': {
      const args = ['lfs', 'pull'];
      if (options.remote) args.push(options.remote);
      args.push(...buildIncludeExcludeArgs(options));
      const output = await git.raw(args);
      return output.trim() || 'LFS pull complete.';
    }

    case 'push': {
      const remote = ensureRemote(options, 'push');
      const args = ['lfs', 'push', remote];
      if (options.everything) args.push('--all');
      const output = await git.raw(args);
      return output.trim() || `LFS push to ${remote} complete.`;
    }

    case 'migrate-import': {
      const args = ['lfs', 'migrate', 'import'];
      if (options.everything) args.push('--everything');
      args.push(...buildIncludeExcludeArgs(options));
      const output = await git.raw(args);
      return output.trim() || 'LFS migrate import complete.';
    }

    case 'migrate-export': {
      const args = ['lfs', 'migrate', 'export'];
      if (options.everything) args.push('--everything');
      args.push(...buildIncludeExcludeArgs(options));
      const output = await git.raw(args);
      return output.trim() || 'LFS migrate export complete.';
    }
  }
}
