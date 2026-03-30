import { getGit } from '../git/client.js';
import type { BranchInfo } from '../types.js';

export interface CreateBranchOptions {
  readonly name: string;
  readonly fromRef?: string;
  readonly checkout: boolean;
}

export interface DeleteBranchOptions {
  readonly name: string;
  readonly force: boolean;
}

export async function listBranches(repoPath: string, all: boolean): Promise<BranchInfo[]> {
  const git = getGit(repoPath);
  const summary = await git.branch(all ? ['-a'] : []);

  return summary.all.map(name => {
    const details = summary.branches[name];
    return {
      name,
      isCurrent: summary.current === name,
      commit: details?.commit,
      upstream: details?.label,
    };
  });
}

export async function createBranch(repoPath: string, options: CreateBranchOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.fromRef) {
    await git.checkoutBranch(options.name, options.fromRef);
    if (!options.checkout) {
      await git.checkout(options.fromRef);
    }
    return `Created branch ${options.name} from ${options.fromRef}.`;
  }

  await git.branch([options.name]);
  if (options.checkout) {
    await git.checkout(options.name);
  }

  return options.checkout ? `Created and checked out ${options.name}.` : `Created branch ${options.name}.`;
}

export async function deleteBranch(repoPath: string, options: DeleteBranchOptions): Promise<string> {
  const git = getGit(repoPath);
  await git.deleteLocalBranch(options.name, options.force);
  return `Deleted branch ${options.name}.`;
}

export async function renameBranch(repoPath: string, oldName: string, newName: string): Promise<string> {
  const git = getGit(repoPath);
  await git.branch(['-m', oldName, newName]);
  return `Renamed branch ${oldName} to ${newName}.`;
}

export async function checkoutRef(repoPath: string, ref: string, create: boolean): Promise<string> {
  const git = getGit(repoPath);

  if (create) {
    await git.checkoutLocalBranch(ref);
    return `Created and checked out ${ref}.`;
  }

  await git.checkout(ref);
  return `Checked out ${ref}.`;
}

export async function setUpstream(repoPath: string, branch: string, upstream: string): Promise<string> {
  const git = getGit(repoPath);
  await git.raw(['branch', '--set-upstream-to', upstream, branch]);
  return `Set upstream of ${branch} to ${upstream}.`;
}
