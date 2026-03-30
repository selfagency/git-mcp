import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toGitError } from '../git/client.js';
import { ConfirmSchema, RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { addFiles, commitChanges, resetChanges, restoreFiles, revertCommit } from '../services/write.service.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    'git_add',
    {
      title: 'Git Add',
      description: 'Stage files in the index.',
      inputSchema: {
        repo_path: RepoPathSchema,
        all: z.boolean().default(false),
        paths: z.array(z.string()).optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      all,
      paths,
      response_format,
    }: {
      repo_path: string;
      all: boolean;
      paths?: string[];
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await addFiles(repo_path, { all, paths });
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_restore',
    {
      title: 'Git Restore',
      description: 'Restore paths in worktree and/or index from current state or source ref.',
      inputSchema: {
        repo_path: RepoPathSchema,
        paths: z.array(z.string()).min(1),
        staged: z.boolean().default(false),
        worktree: z.boolean().default(true),
        source: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      paths,
      staged,
      worktree,
      source,
      response_format,
    }: {
      repo_path: string;
      paths: string[];
      staged: boolean;
      worktree: boolean;
      source?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await restoreFiles(repo_path, { paths, staged, worktree, source });
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_commit',
    {
      title: 'Git Commit',
      description: 'Create a commit from staged changes, optionally amending the previous commit.',
      inputSchema: {
        repo_path: RepoPathSchema,
        message: z.string().min(1),
        all: z.boolean().default(false),
        amend: z.boolean().default(false),
        no_edit: z.boolean().default(false),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      message,
      all,
      amend,
      no_edit,
      response_format,
    }: {
      repo_path: string;
      message: string;
      all: boolean;
      amend: boolean;
      no_edit: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const commitMessage = await commitChanges(repo_path, {
          message,
          all,
          amend,
          noEdit: no_edit,
        });

        return {
          content: [{ type: 'text', text: render({ message: commitMessage }, response_format) }],
          structuredContent: { message: commitMessage },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_reset',
    {
      title: 'Git Reset',
      description: 'Reset HEAD/index/worktree by mode. Hard reset requires confirm=true.',
      inputSchema: {
        repo_path: RepoPathSchema,
        mode: z.enum(['soft', 'mixed', 'hard']).default('mixed'),
        target: z.string().optional(),
        paths: z.array(z.string()).optional(),
        confirm: ConfirmSchema,
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
      mode,
      target,
      paths,
      confirm,
      response_format,
    }: {
      repo_path: string;
      mode: 'soft' | 'mixed' | 'hard';
      target?: string;
      paths?: string[];
      confirm: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        if (mode === 'hard' && !confirm) {
          throw new Error('Hard reset requires confirm=true.');
        }

        const message = await resetChanges(repo_path, { mode, target, paths });
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_revert',
    {
      title: 'Git Revert',
      description: 'Revert a commit without rewriting history.',
      inputSchema: {
        repo_path: RepoPathSchema,
        ref: z.string().min(1),
        no_commit: z.boolean().default(false),
        mainline: z.number().int().min(1).optional(),
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
      ref,
      no_commit,
      mainline,
      response_format,
    }: {
      repo_path: string;
      ref: string;
      no_commit: boolean;
      mainline?: number;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await revertCommit(repo_path, {
          ref,
          noCommit: no_commit,
          mainline,
        });

        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );
}
