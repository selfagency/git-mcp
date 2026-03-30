import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { runLfsAction } from '../services/lfs.service.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }
  return JSON.stringify(content, null, 2);
}

export function registerLfsTools(server: McpServer): void {
  server.registerTool(
    'git_lfs',
    {
      title: 'Git LFS Actions',
      description:
        'Manage Git Large File Storage (LFS). Supports tracking/untracking file patterns, ' +
        'listing LFS-tracked files and status, pulling/pushing LFS objects, installing LFS ' +
        'hooks for the repository, and migrating existing files into or out of LFS storage.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum([
          'track',
          'untrack',
          'ls-files',
          'status',
          'pull',
          'push',
          'install',
          'migrate-import',
          'migrate-export',
        ]),
        patterns: z
          .array(z.string())
          .optional()
          .describe('File glob patterns for track/untrack (e.g. ["*.psd", "*.zip"]).'),
        remote: z.string().optional().describe('Remote name for pull/push operations.'),
        include: z.string().optional().describe('Comma-separated include patterns for migrate or pull operations.'),
        exclude: z.string().optional().describe('Comma-separated exclude patterns for migrate or pull operations.'),
        everything: z
          .boolean()
          .default(false)
          .describe('Pass --all/--everything to include all refs in push/migrate operations.'),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({
      repo_path,
      action,
      patterns,
      remote,
      include,
      exclude,
      everything,
      response_format,
    }: {
      repo_path: string | undefined;
      action:
        | 'track'
        | 'untrack'
        | 'ls-files'
        | 'status'
        | 'pull'
        | 'push'
        | 'install'
        | 'migrate-import'
        | 'migrate-export';
      patterns?: string[];
      remote?: string;
      include?: string;
      exclude?: string;
      everything: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runLfsAction(repoPath, {
          action,
          patterns,
          remote,
          include,
          exclude,
          everything,
        });
        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );
}
