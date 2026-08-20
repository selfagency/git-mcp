import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { createPullRequest, listPullRequests, mergePullRequest } from '../services/pr.service.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

function buildError(error: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
}

export function registerPrTools(server: McpServer): void {
  server.registerTool(
    'git_pr',
    {
      title: 'Git Pull Request',
      description:
        'Create, list, or merge pull requests / merge requests on the detected forge provider ' +
        '(GitHub, GitLab, Forgejo, Gitea, Bitbucket). Uses the provider CLI (gh/glab/tea) when ' +
        'installed, otherwise the provider REST API with a *_TOKEN env var.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['create', 'list', 'merge']).describe('Pull request operation.'),
        title: z.string().optional().describe('PR/MR title (create).'),
        body: z.string().optional().describe('PR/MR body/description (create).'),
        base: z.string().optional().describe('Target branch (create, default main).'),
        head: z.string().optional().describe('Source branch (create, default HEAD).'),
        state: z.enum(['open', 'closed', 'all']).optional().describe('Filter for list (default open).'),
        number: z.number().int().min(1).optional().describe('PR/MR number (merge).'),
        method: z.enum(['merge', 'squash', 'rebase']).optional().describe('Merge method (merge).'),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async ({
      repo_path,
      action,
      title,
      body,
      base,
      head,
      state,
      number,
      method,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'create' | 'list' | 'merge';
      title?: string;
      body?: string;
      base?: string;
      head?: string;
      state?: 'open' | 'closed' | 'all';
      number?: number;
      method?: 'merge' | 'squash' | 'rebase';
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'create') {
          if (!title) {
            throw new Error('title is required for create.');
          }
          const result = await createPullRequest(repoPath, { title, body, base, head });
          return {
            content: [{ type: 'text', text: render(result, response_format) }],
            structuredContent: { pullRequest: result },
          };
        }

        if (action === 'list') {
          const result = await listPullRequests(repoPath, { state, limit: 50 });
          return {
            content: [{ type: 'text', text: render(result, response_format) }],
            structuredContent: { pullRequests: result },
          };
        }

        if (!number) {
          throw new Error('number is required for merge.');
        }
        const output = await mergePullRequest(repoPath, { number, method });
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
