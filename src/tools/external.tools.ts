import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveRepoPath } from '../config.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { checkBut } from '../services/but.service.js';
import { checkJj } from '../services/jj.service.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

export function registerExternalVcsTools(server: McpServer): void {
  server.registerTool(
    'git_but_check',
    {
      title: 'Check GitButler Availability',
      description:
        'Detects whether the GitButler `but` CLI is available and returns guidance on whether to ' +
        'prefer `but mcp` / `but` commands over git-mcp tools. When `but` is present, agents should ' +
        'prefer GitButler for version control and run `but teardown` before using git-mcp tools on a ' +
        'GitButler-managed repository.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ response_format }: { response_format: 'markdown' | 'json' }) => {
      const result = await checkBut();
      return {
        content: [{ type: 'text', text: render(result, response_format) }],
        structuredContent: { result },
      };
    },
  );

  server.registerTool(
    'git_jj_check',
    {
      title: 'Check Jujutsu Availability',
      description:
        'Detect whether the Jujutsu `jj` CLI is available and whether the repository is jj-managed ' +
        '(has a .jj/ directory). When jj-managed, agents should prefer the `jj` CLI for all version ' +
        'control operations, since git-mcp tools operate on the underlying .git and will not reflect ' +
        "jj's change model.",
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
    async ({ repo_path, response_format }: { repo_path: string | undefined; response_format: 'markdown' | 'json' }) => {
      const repoPath = resolveRepoPath(repo_path);
      const result = await checkJj(repoPath);
      return {
        content: [{ type: 'text', text: render(result, response_format) }],
        structuredContent: { result },
      };
    },
  );
}
