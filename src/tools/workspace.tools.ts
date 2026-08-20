import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { getGit, validatePathArguments } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { runBisectAction, runStashAction, runTagAction } from '../services/advanced.service.js';
import { buildToolError } from '../utils/error-response.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

function buildError(error: unknown): ReturnType<typeof buildToolError> {
  return buildToolError(error);
}

/** Shared stash tool. */
function registerGitStashTool(server: McpServer): void {
  server.registerTool(
    'git_stash',
    {
      title: 'Git Stash',
      description: 'Stash, list, apply, pop, or drop stashes.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['save', 'list', 'apply', 'pop', 'drop']).default('list'),
        message: z.string().optional(),
        index: z.number().int().min(0).optional(),
        include_untracked: z.boolean().default(false),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      message,
      index,
      include_untracked,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'save' | 'list' | 'apply' | 'pop' | 'drop';
      message?: string;
      index?: number;
      include_untracked: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runStashAction(repoPath, { action, message, index, includeUntracked: include_untracked });
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared rebase tool. */
function registerGitRebaseTool(server: McpServer): void {
  server.registerTool(
    'git_rebase',
    {
      title: 'Git Rebase',
      description: 'Rebase: start, continue, abort, or skip.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort', 'skip']).default('start'),
        interactive: z.boolean().default(false),
        autosquash: z.boolean().default(false),
        merges: z.boolean().default(false),
        onto: z.string().optional(),
        upstream: z.string().optional(),
        branch: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      interactive,
      autosquash,
      merges,
      onto,
      upstream,
      branch,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort' | 'skip';
      interactive: boolean;
      autosquash: boolean;
      merges: boolean;
      onto?: string;
      upstream?: string;
      branch?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const args = ['rebase'];

        if (action === 'continue') args.push('--continue');
        else if (action === 'abort') args.push('--abort');
        else if (action === 'skip') args.push('--skip');
        else {
          if (interactive) args.push('-i');
          if (autosquash) args.push('--autosquash');
          if (merges) args.push('--rebase-merges');
          if (onto) args.push('--onto', onto);
          if (!upstream) throw new Error('upstream is required for rebase start.');
          args.push(upstream);
          if (branch) args.push(branch);
        }

        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || 'Rebase completed.';
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared cherry-pick tool. */
function registerGitCherryPickTool(server: McpServer): void {
  server.registerTool(
    'git_cherry_pick',
    {
      title: 'Git Cherry-Pick',
      description: 'Cherry-pick: start, continue, or abort.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort']).default('start'),
        refs: z.array(z.string()).optional(),
        mainline: z.number().int().min(1).optional(),
        record_origin: z.boolean().default(false),
        no_commit: z.boolean().default(false),
        strategy: z.string().optional(),
        strategy_options: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      refs,
      mainline,
      record_origin,
      no_commit,
      strategy,
      strategy_options,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort';
      refs?: string[];
      mainline?: number;
      record_origin: boolean;
      no_commit: boolean;
      strategy?: string;
      strategy_options?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const args = ['cherry-pick'];

        if (action === 'continue') args.push('--continue');
        else if (action === 'abort') args.push('--abort');
        else {
          if (mainline !== undefined) args.push('--mainline', String(mainline));
          if (record_origin) args.push('-x');
          if (no_commit) args.push('--no-commit');
          if (strategy) args.push('--strategy', strategy);
          for (const option of strategy_options ?? []) args.push('--strategy-option', option);
          if (!refs || refs.length === 0) throw new Error('refs is required for cherry_pick start.');
          args.push(...refs);
        }

        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || 'Cherry-pick completed.';
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared merge tool. */
function registerGitMergeTool(server: McpServer): void {
  server.registerTool(
    'git_merge',
    {
      title: 'Git Merge',
      description: 'Merge: start, continue, or abort.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort']).default('start'),
        refs: z.array(z.string()).optional(),
        no_ff: z.boolean().default(false),
        ff_only: z.boolean().default(false),
        squash: z.boolean().default(false),
        no_commit: z.boolean().default(false),
        log: z.boolean().default(false),
        strategy: z.string().optional(),
        strategy_options: z.array(z.string()).optional(),
        conflict_style: z.enum(['merge', 'diff3', 'zdiff3']).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      refs,
      no_ff,
      ff_only,
      squash,
      no_commit,
      log,
      strategy,
      strategy_options,
      conflict_style,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort';
      refs?: string[];
      no_ff: boolean;
      ff_only: boolean;
      squash: boolean;
      no_commit: boolean;
      log: boolean;
      strategy?: string;
      strategy_options?: string[];
      conflict_style?: 'merge' | 'diff3' | 'zdiff3';
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);
        const args = ['merge'];

        if (action === 'continue') args.push('--continue');
        else if (action === 'abort') args.push('--abort');
        else {
          if (no_ff) args.push('--no-ff');
          if (ff_only) args.push('--ff-only');
          if (squash) args.push('--squash');
          if (no_commit) args.push('--no-commit');
          if (log) args.push('--log');
          if (strategy) args.push('--strategy', strategy);
          if (conflict_style) args.push(`--conflict=${conflict_style}`);
          for (const option of strategy_options ?? []) args.push('--strategy-option', option);
          if (!refs || refs.length === 0) throw new Error('refs is required for merge start.');
          args.push(...refs);
        }

        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || 'Merge completed.';
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared bisect tool. */
function registerGitBisectTool(server: McpServer): void {
  server.registerTool(
    'git_bisect',
    {
      title: 'Git Bisect',
      description: 'Bisect: start, good, bad, skip, run, or reset.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'good', 'bad', 'skip', 'run', 'reset']).default('start'),
        ref: z.string().optional(),
        good_ref: z.string().optional(),
        bad_ref: z.string().optional(),
        command: z.string().optional(),
        command_args: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      ref,
      good_ref,
      bad_ref,
      command,
      command_args,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'good' | 'bad' | 'skip' | 'run' | 'reset';
      ref?: string;
      good_ref?: string;
      bad_ref?: string;
      command?: string;
      command_args?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runBisectAction(repoPath, {
          action,
          ref,
          goodRef: good_ref,
          badRef: bad_ref,
          command,
          commandArgs: command_args,
        });
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared tag tool. */
function registerGitTagTool(server: McpServer): void {
  server.registerTool(
    'git_tag',
    {
      title: 'Git Tag',
      description: 'Tag: list, create, or delete.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['list', 'create', 'delete']).default('list'),
        name: z.string().optional(),
        target: z.string().optional(),
        message: z.string().optional(),
        sign: z.boolean().optional().describe('Sign the tag. Defaults to the server GIT_AUTO_SIGN_TAGS setting.'),
        signing_key: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      name,
      target,
      message,
      sign,
      signing_key,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'list' | 'create' | 'delete';
      name?: string;
      target?: string;
      message?: string;
      sign?: boolean;
      signing_key?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runTagAction(repoPath, { action, name, target, message, sign, signingKey: signing_key });
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared worktree tool. */
function registerGitWorktreeTool(server: McpServer): void {
  server.registerTool(
    'git_worktree',
    {
      title: 'Git Worktree',
      description: 'Worktree: add, list, remove, lock, unlock, prune, or repair.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'list', 'remove', 'lock', 'unlock', 'prune', 'repair']).default('list'),
        path: z.string().optional(),
        branch: z.string().optional(),
        force: z.boolean().default(false),
        detached: z.boolean().default(false),
        lock_reason: z.string().optional(),
        expire: z.string().optional(),
        paths: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      path,
      branch,
      force,
      detached,
      lock_reason,
      expire,
      paths,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'list' | 'remove' | 'lock' | 'unlock' | 'prune' | 'repair';
      path?: string;
      branch?: string;
      force: boolean;
      detached: boolean;
      lock_reason?: string;
      expire?: string;
      paths?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);

        if (action === 'list') {
          const rawOutput = await git.raw(['worktree', 'list', '--porcelain']);
          const output = rawOutput.trim() || 'No worktrees.';
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'remove') {
          if (!path) throw new Error('path is required for worktree remove.');
          const args = ['worktree', 'remove'];
          if (force) args.push('--force');
          args.push(path);
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || `Removed worktree ${path}.`;
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'lock' || action === 'unlock') {
          if (!path) throw new Error('path is required for worktree lock/unlock.');
          const args = ['worktree', action, path];
          if (action === 'lock' && lock_reason) args.push('--reason', lock_reason);
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || `Worktree ${action} completed for ${path}.`;
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'prune') {
          const args = ['worktree', 'prune'];
          if (expire) args.push(`--expire=${expire}`);
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Worktree prune completed.';
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'repair') {
          const args = ['worktree', 'repair'];
          if (paths && paths.length > 0) args.push(...paths);
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Worktree repair completed.';
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (!path) throw new Error('path is required for worktree add.');
        const args = ['worktree', 'add'];
        if (force) args.push('--force');
        if (detached) args.push('--detach');
        if (lock_reason) args.push('--lock', '--reason', lock_reason);
        args.push(path);
        if (branch) args.push(branch);
        else if (!detached) throw new Error('branch is required for worktree add unless detached=true.');
        const rawOutput = await git.raw(args);
        const output = rawOutput.trim() || `Added worktree at ${path}.`;
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

/** Shared submodule tool. */
function registerGitSubmoduleTool(server: McpServer): void {
  server.registerTool(
    'git_submodule',
    {
      title: 'Git Submodule',
      description: 'Submodule: add, list, update, sync, or set_branch.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'list', 'update', 'sync', 'set_branch']).default('list'),
        url: z.string().optional(),
        path: z.string().optional(),
        branch: z.string().optional(),
        recursive: z.boolean().default(true),
        remote: z.boolean().default(false),
        depth: z.number().int().min(1).optional(),
        jobs: z.number().int().min(1).optional(),
        paths: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({
      repo_path,
      action,
      url,
      path,
      branch,
      recursive,
      remote,
      depth,
      jobs,
      paths,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'list' | 'update' | 'sync' | 'set_branch';
      url?: string;
      path?: string;
      branch?: string;
      recursive: boolean;
      remote: boolean;
      depth?: number;
      jobs?: number;
      paths?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);

        if (action === 'list') {
          const rawOutput = await git.raw(['submodule', 'status']);
          const output = rawOutput.trim() || 'No submodules.';
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'sync') {
          const args = ['submodule', 'sync'];
          if (recursive) args.push('--recursive');
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Submodule sync complete.';
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'update') {
          const args = ['submodule', 'update', '--init'];
          if (recursive) args.push('--recursive');
          if (remote) args.push('--remote');
          if (depth !== undefined) args.push('--depth', String(depth));
          if (jobs !== undefined) args.push('--jobs', String(jobs));
          if (paths && paths.length > 0) args.push('--', ...validatePathArguments(repoPath, paths));
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Submodule update complete.';
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (action === 'set_branch') {
          if (!branch || !path) throw new Error('branch and path are required for submodule set_branch.');
          const [safePath] = validatePathArguments(repoPath, [path]);
          const rawOutput = await git.raw(['submodule', 'set-branch', '--branch', branch, '--', safePath]);
          const output = rawOutput.trim() || `Set submodule ${safePath} branch to ${branch}.`;
          return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
        }

        if (!url || !path) throw new Error('url and path are required for submodule add.');
        const [safePath] = validatePathArguments(repoPath, [path]);
        const rawOutput = await git.raw(['submodule', 'add', url, safePath]);
        const output = rawOutput.trim() || `Added submodule ${safePath}.`;
        return { content: [{ type: 'text', text: render(output, response_format) }], structuredContent: { output } };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}

export function registerWorkspaceTools(server: McpServer): void {
  registerGitStashTool(server);
  registerGitRebaseTool(server);
  registerGitCherryPickTool(server);
  registerGitMergeTool(server);
  registerGitBisectTool(server);
  registerGitTagTool(server);
  registerGitWorktreeTool(server);
  registerGitSubmoduleTool(server);
}
