import { ALLOW_FORCE_PUSH, ALLOW_NO_VERIFY } from '../config.js';
import { getGit } from '../git/client.js';
import type { RemoteInfo } from '../types.js';

export interface ManageRemoteOptions {
  readonly action: 'add' | 'remove' | 'set-url';
  readonly name: string;
  readonly url?: string;
}

export interface FetchOptions {
  readonly remote?: string;
  readonly branch?: string;
  readonly prune: boolean;
}

export interface PullOptions {
  readonly remote?: string;
  readonly branch?: string;
  readonly rebase: boolean;
}

export interface PushOptions {
  readonly remote?: string;
  readonly branch?: string;
  readonly setUpstream: boolean;
  readonly forceWithLease: boolean;
  /** Hard force push. Requires ALLOW_FORCE_PUSH=true. Only use when you know what you are doing. */
  readonly force?: boolean;
  /** Pass --no-verify to bypass pre-push hooks. Requires ALLOW_NO_VERIFY=true. */
  readonly noVerify?: boolean;
  readonly tags: boolean;
}

function formatRemoteBranch(remote?: string, branch?: string): string {
  const remoteLabel = remote ?? 'tracking remote';
  const branchSuffix = branch ? `/${branch}` : '';
  return `${remoteLabel}${branchSuffix}`;
}

function sanitizeRemoteUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';

    // Redact common credential-like query parameters while preserving key names.
    for (const key of parsed.searchParams.keys()) {
      if (/(token|auth|password|secret|key)/i.test(key)) {
        parsed.searchParams.set(key, '***');
      }
    }

    // Redact opaque token-like path segments often used by some hosted providers.
    parsed.pathname = parsed.pathname
      .split('/')
      .map(segment => (/^[A-Za-z0-9_-]{20,}$/.test(segment) ? '***' : segment))
      .join('/');

    return parsed.toString();
  } catch {
    // SCP-style URLs (e.g. git@github.com:org/repo.git) are not parseable by URL
    return url;
  }
}

export async function listRemotes(repoPath: string): Promise<RemoteInfo[]> {
  const git = getGit(repoPath);
  const remotes = await git.getRemotes(true);

  return remotes.map(remote => ({
    name: remote.name,
    fetchUrl: sanitizeRemoteUrl(remote.refs.fetch),
    pushUrl: sanitizeRemoteUrl(remote.refs.push),
  }));
}

export async function manageRemote(repoPath: string, options: ManageRemoteOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'add') {
    if (!options.url) {
      throw new Error("url is required for action='add'");
    }
    await git.addRemote(options.name, options.url);
    return `Added remote ${options.name}.`;
  }

  if (options.action === 'remove') {
    await git.removeRemote(options.name);
    return `Removed remote ${options.name}.`;
  }

  if (!options.url) {
    throw new Error("url is required for action='set-url'");
  }

  await git.remote(['set-url', options.name, options.url]);
  return `Updated remote ${options.name} URL.`;
}

export async function fetchRemote(repoPath: string, options: FetchOptions): Promise<string> {
  const git = getGit(repoPath);

  const args: string[] = [];
  if (options.prune) {
    args.push('--prune');
  }

  // Only pass remote and branch if they are defined, otherwise use overloads
  if (options.remote && options.branch) {
    await git.fetch(options.remote, options.branch, args);
    return `Fetched ${options.remote}/${options.branch}.`;
  } else if (options.remote) {
    await git.fetch(options.remote, args);
    return `Fetched ${options.remote}.`;
  } else {
    await git.fetch(args);
    return 'Fetched default remote.';
  }
}

export async function pullRemote(repoPath: string, options: PullOptions): Promise<string> {
  const git = getGit(repoPath);

  const pullOptions: string[] = [];
  if (options.rebase) {
    pullOptions.push('--rebase');
  }

  await git.pull(options.remote, options.branch, pullOptions);
  const target = formatRemoteBranch(options.remote, options.branch);
  const suffix = options.rebase ? ' with rebase' : '';
  return `Pulled ${target}${suffix}.`;
}

export async function pushRemote(repoPath: string, options: PushOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.noVerify && !ALLOW_NO_VERIFY) {
    throw new Error(
      'no_verify is disabled on this server. Set GIT_ALLOW_NO_VERIFY=true to permit bypassing git hooks.',
    );
  }

  if (options.force && !ALLOW_FORCE_PUSH) {
    throw new Error(
      'force push is disabled on this server. Set GIT_ALLOW_FORCE_PUSH=true to enable it. ' +
        'Consider using force_with_lease instead for a safer alternative.',
    );
  }

  const pushOptions: string[] = [];
  if (options.setUpstream) {
    pushOptions.push('--set-upstream');
  }

  if (options.forceWithLease) {
    pushOptions.push('--force-with-lease');
  }

  if (options.force) {
    pushOptions.push('--force');
  }

  if (options.tags) {
    pushOptions.push('--tags');
  }

  if (options.noVerify) {
    pushOptions.push('--no-verify');
  }

  await git.push(options.remote, options.branch, pushOptions);
  return `Pushed ${formatRemoteBranch(options.remote, options.branch)}.`;
}
