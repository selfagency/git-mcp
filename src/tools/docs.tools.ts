import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toGitError } from '../git/client.js';
import { ResponseFormatSchema } from '../schemas/index.js';
import { fetchGitManPage, searchGitDocs } from '../services/docs.service.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

export function registerDocsTools(server: McpServer): void {
  server.registerTool(
    'git_docs',
    {
      title: 'Git Documentation',
      description:
        'Search and browse official Git documentation from git-scm.com. ' +
        'Use action="search" to find relevant commands and concepts by keyword. ' +
        'Use action="man" to fetch the full man page for a specific git command ' +
        '(e.g. query="commit" fetches the git-commit man page). ' +
        'Useful for answering questions about how to use git commands, understanding options, ' +
        'and discovering the right git command for a task.',
      inputSchema: {
        action: z.enum(['search', 'man']),
        query: z
          .string()
          .min(1)
          .describe(
            'For action="search": search terms (e.g. "undo last commit"). ' +
              'For action="man": git command name without "git-" prefix (e.g. "commit", "rebase", "merge").',
          ),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({
      action,
      query,
      response_format,
    }: {
      action: 'search' | 'man';
      query: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        if (action === 'search') {
          const results = await searchGitDocs(query);
          const structuredContent: Record<string, unknown> = {
            query: results.query,
            results: results.results,
          };

          if (response_format === 'json') {
            return {
              content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
              structuredContent,
            };
          }

          if (results.results.length === 0) {
            const text = `No results found for "${query}" on git-scm.com.`;
            return { content: [{ type: 'text', text }], structuredContent };
          }

          const lines = [`## Git Docs Search: "${results.query}"`, ''];
          for (const r of results.results) {
            lines.push(`### [${r.title}](${r.url})`);
            if (r.excerpt) lines.push(r.excerpt);
            lines.push('');
          }

          const text = lines.join('\n');
          return { content: [{ type: 'text', text }], structuredContent };
        }

        // action === 'man'
        const text = await fetchGitManPage(query);
        return {
          content: [{ type: 'text', text: render(text, response_format) }],
          structuredContent: { command: query, content: text } as Record<string, unknown>,
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );
}
