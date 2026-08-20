import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import {
  createBackup,
  restoreBackup,
  rewordCommit,
  rewriteMessages,
  squashCommits,
} from '../services/rewrite.service.js';
import { renderContent } from './render.js';
import { buildToolError } from '../utils/error-response.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

function buildError(error: unknown): ReturnType<typeof buildToolError> {
  return buildToolError(error);
}

export function registerRewriteTools(server: McpServer): void {
  server.registerTool(
    'git_rewrite',
    {
      title: 'Git History Rewrite',
      description:
        'Rewrite commit history. Use action=reword|squash|rewrite-messages|backup|restore. ' +
        'History rewriting changes commit hashes and requires force-push; create a backup first.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z
          .enum(['reword', 'squash', 'rewrite-messages', 'backup', 'restore'])
          .describe('History rewrite operation.'),
        ref: z.string().optional().describe('Commit ref to reword (defaults to HEAD).'),
        message: z.string().optional().describe('New commit message (reword/squash).'),
        count: z.number().int().min(2).optional().describe('Number of commits to squash.'),
        range: z.string().optional().describe('Commit range to rewrite (e.g. HEAD~5..HEAD).'),
        messages: z
          .record(z.string(), z.string())
          .optional()
          .describe('Map of commit SHA to replacement message (rewrite-messages).'),
        name: z.string().optional().describe('Backup branch name (backup/restore).'),
        confirm: z.boolean().default(false).describe('Confirm destructive history rewrite.'),
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
      message,
      count,
      range,
      messages,
      name,
      confirm,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'reword' | 'squash' | 'rewrite-messages' | 'backup' | 'restore';
      ref?: string;
      message?: string;
      count?: number;
      range?: string;
      messages?: Record<string, string>;
      name?: string;
      confirm: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'backup') {
          if (!name) {
            throw new Error('name is required for backup.');
          }
          const output = await createBackup(repoPath, { name });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'restore') {
          if (!name) {
            throw new Error('name is required for restore.');
          }
          if (!confirm) {
            throw new Error('restore requires confirm=true because it performs a hard reset.');
          }
          const output = await restoreBackup(repoPath, { name });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'reword') {
          if (!message) {
            throw new Error('message is required for reword.');
          }
          if (!confirm) {
            throw new Error('reword requires confirm=true because it rewrites history.');
          }
          const output = await rewordCommit(repoPath, { ref, message });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'squash') {
          if (!message) {
            throw new Error('message is required for squash.');
          }
          if (!count) {
            throw new Error('count is required for squash.');
          }
          if (!confirm) {
            throw new Error('squash requires confirm=true because it rewrites history.');
          }
          const output = await squashCommits(repoPath, { count, message });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        // rewrite-messages
        if (!range) {
          throw new Error('range is required for rewrite-messages.');
        }
        if (!messages || Object.keys(messages).length === 0) {
          throw new Error('messages mapping is required for rewrite-messages.');
        }
        if (!confirm) {
          throw new Error('rewrite-messages requires confirm=true because it rewrites history.');
        }
        const output = await rewriteMessages(repoPath, { range, messages });
        return {
          content: [{ type: 'text', text: render(output, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}
