import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import {
  runBisectAction,
  runCherryPickAction,
  runRebaseAction,
  runStashAction,
  runSubmoduleAction,
  runTagAction,
  runWorktreeAction,
} from '../services/advanced.service.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

function buildError(error: unknown): { content: Array<{ type: 'text'; text: string }> } {
  const gitError = toGitError(error);
  return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
}

export function registerAdvancedTools(server: McpServer): void {
  server.registerTool(
    'git_stash',
    {
      title: 'Git Stash Actions',
      description: 'Save, list, apply, pop, or drop stash entries.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['save', 'list', 'apply', 'pop', 'drop']),
        message: z.string().optional(),
        index: z.number().int().min(0).optional(),
        include_untracked: z.boolean().default(false),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
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
        const output = await runStashAction(repoPath, {
          action,
          message,
          index,
          includeUntracked: include_untracked,
        });

        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_rebase',
    {
      title: 'Git Rebase Actions',
      description: 'Start, continue, skip, or abort rebase operations.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort', 'skip']),
        onto: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      onto,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort' | 'skip';
      onto?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runRebaseAction(repoPath, { action, onto });
        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_cherry_pick',
    {
      title: 'Git Cherry-pick Actions',
      description: 'Start, continue, or abort cherry-pick.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'continue', 'abort']),
        ref: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      ref,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'continue' | 'abort';
      ref?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runCherryPickAction(repoPath, { action, ref });
        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_bisect',
    {
      title: 'Git Bisect Actions',
      description: 'Run bisect workflows for bug isolation.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['start', 'good', 'bad', 'skip', 'run', 'reset']),
        ref: z.string().optional(),
        good_ref: z.string().optional(),
        bad_ref: z.string().optional(),
        command: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      ref,
      good_ref,
      bad_ref,
      command,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'good' | 'bad' | 'skip' | 'run' | 'reset';
      ref?: string;
      good_ref?: string;
      bad_ref?: string;
      command?: string;
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
        });

        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_tag',
    {
      title: 'Git Tag Actions',
      description: 'List, create, or delete tags. Supports GPG/SSH signed tags.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['list', 'create', 'delete']),
        name: z.string().optional(),
        target: z.string().optional(),
        message: z.string().optional(),
        sign: z
          .boolean()
          .default(false)
          .describe('Create a signed tag (-s/-u). Defaults to server AUTO_SIGN_TAGS setting.'),
        signing_key: z
          .string()
          .optional()
          .describe('Specific signing key ID or path. Falls back to GIT_SIGNING_KEY env var.'),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
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
      sign: boolean;
      signing_key?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runTagAction(repoPath, {
          action,
          name,
          target,
          message,
          sign,
          signingKey: signing_key,
        });
        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_worktree',
    {
      title: 'Git Worktree Actions',
      description: 'Add, list, or remove worktrees.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'list', 'remove']),
        path: z.string().optional(),
        branch: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      path,
      branch,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'list' | 'remove';
      path?: string;
      branch?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runWorktreeAction(repoPath, { action, path, branch });
        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_submodule',
    {
      title: 'Git Submodule Actions',
      description: 'Add, list, update, or sync submodules.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'list', 'update', 'sync']),
        url: z.string().optional(),
        path: z.string().optional(),
        recursive: z.boolean().default(true),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      url,
      path,
      recursive,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'list' | 'update' | 'sync';
      url?: string;
      path?: string;
      recursive: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runSubmoduleAction(repoPath, {
          action,
          url,
          path,
          recursive,
        });

        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}
