import { getGit } from '../git/client.js';
import { assertSafeArg, assertSafeRef } from '../security/args.js';
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
    const details = Object.hasOwn(summary.branches, name) ? summary.branches[name] : undefined;
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
  const name = assertSafeArg(options.name, 'branch name');
  const fromRef = options.fromRef ? assertSafeRef(options.fromRef, 'from_ref') : undefined;

  if (fromRef) {
    if (options.checkout) {
      await git.checkoutBranch(name, fromRef);
    } else {
      await git.raw(['branch', name, fromRef]);
    }
    return options.checkout
      ? `Created and checked out ${name} from ${fromRef}.`
      : `Created branch ${name} from ${fromRef}.`;
  }

  await git.branch([name]);
  if (options.checkout) {
    await git.checkout(name);
  }

  return options.checkout ? `Created and checked out ${name}.` : `Created branch ${name}.`;
}

export async function deleteBranch(repoPath: string, options: DeleteBranchOptions): Promise<string> {
  const git = getGit(repoPath);
  const name = assertSafeArg(options.name, 'branch name');
  await git.deleteLocalBranch(name, options.force);
  return `Deleted branch ${name}.`;
}

export async function renameBranch(repoPath: string, oldName: string, newName: string): Promise<string> {
  const git = getGit(repoPath);
  const oldSafe = assertSafeArg(oldName, 'old branch name');
  const newSafe = assertSafeArg(newName, 'new branch name');
  await git.branch(['-m', oldSafe, newSafe]);
  return `Renamed branch ${oldSafe} to ${newSafe}.`;
}

export async function checkoutRef(repoPath: string, ref: string, create: boolean): Promise<string> {
  const git = getGit(repoPath);
  const safeRef = assertSafeRef(ref, 'ref');

  if (create) {
    await git.checkoutLocalBranch(safeRef);
    return `Created and checked out ${safeRef}.`;
  }

  await git.checkout(safeRef);
  return `Checked out ${safeRef}.`;
}

export async function setUpstream(repoPath: string, branch: string, upstream: string): Promise<string> {
  const git = getGit(repoPath);
  const branchSafe = assertSafeArg(branch, 'branch');
  const upstreamSafe = assertSafeRef(upstream, 'upstream');
  await git.raw(['branch', '--set-upstream-to', upstreamSafe, branchSafe]);
  return `Set upstream of ${branchSafe} to ${upstreamSafe}.`;
}
