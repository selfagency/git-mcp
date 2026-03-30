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
  readonly tags: boolean;
}

export async function listRemotes(repoPath: string): Promise<RemoteInfo[]> {
  const git = getGit(repoPath);
  const remotes = await git.getRemotes(true);

  return remotes.map(remote => ({
    name: remote.name,
    fetchUrl: remote.refs.fetch,
    pushUrl: remote.refs.push,
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
  return `Pulled ${options.remote ?? 'tracking remote'}${options.branch ? `/${options.branch}` : ''}${options.rebase ? ' with rebase' : ''}.`;
}

export async function pushRemote(repoPath: string, options: PushOptions): Promise<string> {
  const git = getGit(repoPath);

  const pushOptions: string[] = [];
  if (options.setUpstream) {
    pushOptions.push('--set-upstream');
  }

  if (options.forceWithLease) {
    pushOptions.push('--force-with-lease');
  }

  if (options.tags) {
    pushOptions.push('--tags');
  }

  await git.push(options.remote, options.branch, pushOptions);
  return `Pushed ${options.remote ?? 'tracking remote'}${options.branch ? `/${options.branch}` : ''}.`;
}
