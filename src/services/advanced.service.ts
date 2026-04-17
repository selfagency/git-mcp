import { AUTO_SIGN_TAGS, DEFAULT_SIGNING_KEY } from '../config.js';
import { getGit, validatePathArgument } from '../git/client.js';

export interface StashActionOptions {
  readonly action: 'save' | 'list' | 'apply' | 'pop' | 'drop';
  readonly message?: string;
  readonly index?: number;
  readonly includeUntracked?: boolean;
}

export interface RebaseActionOptions {
  readonly action: 'start' | 'continue' | 'abort' | 'skip';
  readonly onto?: string;
}

export interface CherryPickActionOptions {
  readonly action: 'start' | 'continue' | 'abort';
  readonly ref?: string;
}

export interface BisectActionOptions {
  readonly action: 'start' | 'good' | 'bad' | 'skip' | 'run' | 'reset';
  readonly ref?: string;
  readonly goodRef?: string;
  readonly badRef?: string;
  readonly command?: string;
  readonly commandArgs?: readonly string[];
}

const SHELL_META_PATTERN = /[;&|`$<>()[\]{}]/;

export interface TagActionOptions {
  readonly action: 'list' | 'create' | 'delete';
  readonly name?: string;
  readonly target?: string;
  readonly message?: string;
  /** Sign the tag. Defaults to AUTO_SIGN_TAGS server config. */
  readonly sign?: boolean;
  /** Signing key to use. Falls back to DEFAULT_SIGNING_KEY, then git's user.signingkey. */
  readonly signingKey?: string;
}

export interface WorktreeActionOptions {
  readonly action: 'add' | 'list' | 'remove';
  readonly path?: string;
  readonly branch?: string;
}

export interface SubmoduleActionOptions {
  readonly action: 'add' | 'list' | 'update' | 'sync';
  readonly url?: string;
  readonly path?: string;
  readonly recursive?: boolean;
}

export async function runStashAction(repoPath: string, options: StashActionOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'save') {
    const args = ['stash', 'push'];
    if (options.includeUntracked) {
      args.push('--include-untracked');
    }
    if (options.message) {
      args.push('-m', options.message);
    }
    const output = await git.raw(args);
    return output.trim() || 'Stash saved.';
  }

  if (options.action === 'list') {
    const output = await git.raw(['stash', 'list']);
    return output.trim() || 'No stashes.';
  }

  const index = options.index ?? 0;
  if (options.action === 'apply') {
    const output = await git.raw(['stash', 'apply', `stash@{${index}}`]);
    return output.trim() || `Applied stash@{${index}}.`;
  }

  if (options.action === 'pop') {
    const output = await git.raw(['stash', 'pop', `stash@{${index}}`]);
    return output.trim() || `Popped stash@{${index}}.`;
  }

  const output = await git.raw(['stash', 'drop', `stash@{${index}}`]);
  return output.trim() || `Dropped stash@{${index}}.`;
}

export async function runRebaseAction(repoPath: string, options: RebaseActionOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'continue') {
    const output = await git.raw(['rebase', '--continue']);
    return output.trim() || 'Rebase continued.';
  }

  if (options.action === 'abort') {
    const output = await git.raw(['rebase', '--abort']);
    return output.trim() || 'Rebase aborted.';
  }

  if (options.action === 'skip') {
    const output = await git.raw(['rebase', '--skip']);
    return output.trim() || 'Rebase skipped current commit.';
  }

  if (!options.onto) {
    throw new Error('onto is required for rebase start.');
  }

  const output = await git.raw(['rebase', options.onto]);
  return output.trim() || `Rebase started onto ${options.onto}.`;
}

export async function runCherryPickAction(repoPath: string, options: CherryPickActionOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'continue') {
    const output = await git.raw(['cherry-pick', '--continue']);
    return output.trim() || 'Cherry-pick continued.';
  }

  if (options.action === 'abort') {
    const output = await git.raw(['cherry-pick', '--abort']);
    return output.trim() || 'Cherry-pick aborted.';
  }

  if (!options.ref) {
    throw new Error('ref is required when cherry-pick action is start.');
  }

  const output = await git.raw(['cherry-pick', options.ref]);
  return output.trim() || `Cherry-picked ${options.ref}.`;
}

export async function runBisectAction(repoPath: string, options: BisectActionOptions): Promise<string> {
  const git = getGit(repoPath);

  switch (options.action) {
    case 'start': {
      if (!options.badRef || !options.goodRef) {
        throw new Error('goodRef and badRef are required for bisect start.');
      }
      await git.raw(['bisect', 'start']);
      await git.raw(['bisect', 'bad', options.badRef]);
      await git.raw(['bisect', 'good', options.goodRef]);
      return `Bisect started between good=${options.goodRef} and bad=${options.badRef}.`;
    }
    case 'good': {
      const output = await git.raw(['bisect', 'good', ...(options.ref ? [options.ref] : [])]);
      return output.trim() || 'Marked current commit as good.';
    }
    case 'bad': {
      const output = await git.raw(['bisect', 'bad', ...(options.ref ? [options.ref] : [])]);
      return output.trim() || 'Marked current commit as bad.';
    }
    case 'skip': {
      const output = await git.raw(['bisect', 'skip', ...(options.ref ? [options.ref] : [])]);
      return output.trim() || 'Skipped current bisect commit.';
    }
    case 'run': {
      if (options.command && SHELL_META_PATTERN.test(options.command)) {
        throw new Error('command contains shell metacharacters. Use command_args for bisect run.');
      }

      if (options.command && /\s/.test(options.command)) {
        throw new Error('command must be a single executable token. Use command_args to pass arguments.');
      }

      const commandArgs = options.commandArgs ?? (options.command ? [options.command] : undefined);
      if (!commandArgs || commandArgs.length === 0) {
        throw new Error('command_args (or command) is required for bisect run.');
      }

      const output = await git.raw(['bisect', 'run', ...commandArgs]);
      return output.trim() || 'Bisect run completed.';
    }
    case 'reset': {
      const output = await git.raw(['bisect', 'reset']);
      return output.trim() || 'Bisect reset.';
    }
  }
}

export async function runTagAction(repoPath: string, options: TagActionOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'list') {
    const output = await git.tags();
    return output.all.join('\n') || 'No tags.';
  }

  if (options.action === 'delete') {
    if (!options.name) {
      throw new Error('name is required for delete action.');
    }
    await git.tag(['-d', options.name]);
    return `Deleted tag ${options.name}.`;
  }

  if (!options.name) {
    throw new Error('name is required for create action.');
  }

  const shouldSign = options.sign ?? AUTO_SIGN_TAGS;

  if (shouldSign) {
    const key = options.signingKey ?? DEFAULT_SIGNING_KEY;
    const signFlag = key ? ['-u', key] : ['-s'];
    const msgFlag = options.message ? ['-m', options.message] : ['-m', options.name];
    const targetArg = options.target ? [options.target] : [];
    await git.raw(['tag', ...signFlag, ...msgFlag, options.name, ...targetArg]);
    return `Created signed tag ${options.name}.`;
  }

  if (options.message) {
    await git.addAnnotatedTag(options.name, options.message);
    return `Created annotated tag ${options.name}.`;
  }

  // Only pass the tag name (string) to addTag
  await git.addTag(options.name);
  return `Created tag ${options.name}.`;
}

export async function runWorktreeAction(repoPath: string, options: WorktreeActionOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'list') {
    const output = await git.raw(['worktree', 'list', '--porcelain']);
    return output.trim();
  }

  if (options.action === 'remove') {
    if (!options.path) {
      throw new Error('path is required for worktree remove.');
    }
    await git.raw(['worktree', 'remove', options.path]);
    return `Removed worktree ${options.path}.`;
  }

  if (!options.path || !options.branch) {
    throw new Error('path and branch are required for worktree add.');
  }

  await git.raw(['worktree', 'add', options.path, options.branch]);
  return `Added worktree at ${options.path} for ${options.branch}.`;
}

export async function runSubmoduleAction(repoPath: string, options: SubmoduleActionOptions): Promise<string> {
  const git = getGit(repoPath);

  if (options.action === 'list') {
    const output = await git.raw(['submodule', 'status']);
    return output.trim() || 'No submodules.';
  }

  if (options.action === 'sync') {
    const args = ['submodule', 'sync'];
    if (options.recursive) {
      args.push('--recursive');
    }
    const output = await git.raw(args);
    return output.trim() || 'Submodule sync complete.';
  }

  if (options.action === 'update') {
    const args = ['submodule', 'update', '--init'];
    if (options.recursive) {
      args.push('--recursive');
    }
    const output = await git.raw(args);
    return output.trim() || 'Submodule update complete.';
  }

  if (!options.url || !options.path) {
    throw new Error('url and path are required for submodule add.');
  }

  const safePath = validatePathArgument(repoPath, options.path);

  await git.raw(['submodule', 'add', options.url, safePath]);
  return `Added submodule ${safePath}.`;
}
