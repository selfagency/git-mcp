import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { getActivity, getChurn, getContributors, getFileStats, getRepoSummary } from '../services/analytics.service.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

function buildError(error: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
}

export function registerAnalyticsTools(server: McpServer): void {
  server.registerTool(
    'git_analytics',
    {
      title: 'Git Repository Analytics',
      description:
        'Read-only repository analytics computed from local git history. ' +
        'Use action=contributors|churn|activity|summary|file-stats.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['contributors', 'churn', 'activity', 'summary', 'file-stats']).describe('Analytics operation.'),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'contributors' | 'churn' | 'activity' | 'summary' | 'file-stats';
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'contributors') {
          const result = await getContributors(repoPath);
          return {
            content: [{ type: 'text', text: render(result, response_format) }],
            structuredContent: { contributors: result },
          };
        }

        if (action === 'churn') {
          const result = await getChurn(repoPath);
          return {
            content: [{ type: 'text', text: render(result, response_format) }],
            structuredContent: { churn: result },
          };
        }

        if (action === 'activity') {
          const result = await getActivity(repoPath);
          return {
            content: [{ type: 'text', text: render(result, response_format) }],
            structuredContent: { activity: result },
          };
        }

        if (action === 'summary') {
          const result = await getRepoSummary(repoPath);
          return {
            content: [{ type: 'text', text: render(result, response_format) }],
            structuredContent: { summary: result },
          };
        }

        const result = await getFileStats(repoPath);
        return {
          content: [{ type: 'text', text: render(result, response_format) }],
          structuredContent: { fileStats: result },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}
