import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { getConfig, getContextSummary, searchHistory, setConfig } from '../services/context.service.js';

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

export function registerContextTools(server: McpServer): void {
  server.registerTool(
    'git_context_summary',
    {
      title: 'Git Context Summary',
      description: 'High-signal repository context for LLM-assisted workflows.',
      inputSchema: {
        repo_path: RepoPathSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ repo_path, response_format }: { repo_path: string; response_format: 'markdown' | 'json' }) => {
      try {
        const summary = await getContextSummary(repo_path);
        return {
          content: [{ type: 'text', text: render(summary, response_format) }],
          structuredContent: { summary },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_search',
    {
      title: 'Git Search',
      description: 'Search code and history using pickaxe and grep.',
      inputSchema: {
        repo_path: RepoPathSchema,
        query: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(20),
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
      query,
      limit,
      response_format,
    }: {
      repo_path: string;
      query: string;
      limit: number;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const output = await searchHistory(repo_path, query, limit);
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
    'git_get_config',
    {
      title: 'Get Git Config',
      description: 'Read repository/local git configuration values.',
      inputSchema: {
        repo_path: RepoPathSchema,
        key: z.string().optional(),
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
      key,
      response_format,
    }: {
      repo_path: string;
      key?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const value = await getConfig(repo_path, key);
        return {
          content: [{ type: 'text', text: render({ value }, response_format) }],
          structuredContent: { value },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_set_config',
    {
      title: 'Set Git Config',
      description: 'Set repository-local git configuration value.',
      inputSchema: {
        repo_path: RepoPathSchema,
        key: z.string().min(1),
        value: z.string(),
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
      key,
      value,
      response_format,
    }: {
      repo_path: string;
      key: string;
      value: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await setConfig(repo_path, key, value);
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}
