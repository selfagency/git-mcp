import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveRepoPath } from '../config.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { checkBut } from '../services/but.service.js';
import { checkEntire } from '../services/entire.service.js';
import { checkJj } from '../services/jj.service.js';
import { checkTangled } from '../services/tangled.service.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

interface CheckToolConfig {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly needsRepoPath: boolean;
  readonly check: (repoPath: string | undefined) => Promise<unknown>;
}

function registerCheckTool(server: McpServer, config: CheckToolConfig): void {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: {
        ...(config.needsRepoPath ? { repo_path: RepoPathSchema } : {}),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ repo_path, response_format }: { repo_path?: string; response_format: 'markdown' | 'json' }) => {
      const repoPath = config.needsRepoPath ? resolveRepoPath(repo_path) : undefined;
      const result = await config.check(repoPath);
      return {
        content: [{ type: 'text', text: render(result, response_format) }],
        structuredContent: { result },
      };
    },
  );
}

export function registerExternalVcsTools(server: McpServer): void {
  registerCheckTool(server, {
    name: 'git_but_check',
    title: 'Check GitButler Availability',
    description:
      'Detects whether the GitButler `but` CLI is available and returns guidance on whether to ' +
      'prefer `but mcp` / `but` commands over git-mcp tools. When `but` is present, agents should ' +
      'prefer GitButler for version control and run `but teardown` before using git-mcp tools on a ' +
      'GitButler-managed repository.',
    needsRepoPath: false,
    check: () => checkBut(),
  });

  registerCheckTool(server, {
    name: 'git_jj_check',
    title: 'Check Jujutsu Availability',
    description:
      'Detect whether the Jujutsu `jj` CLI is available and whether the repository is jj-managed ' +
      '(has a .jj/ directory). When jj-managed, agents should prefer the `jj` CLI for all version ' +
      'control operations, since git-mcp tools operate on the underlying .git and will not reflect ' +
      "jj's change model.",
    needsRepoPath: true,
    check: repoPath => checkJj(repoPath as string),
  });

  registerCheckTool(server, {
    name: 'git_tangled_check',
    title: 'Check Tangled Hosting',
    description:
      'Detect whether the repository origin remote points at a Tangled host (tangled.org or a ' +
      'self-hosted knot). Tangled is a decentralized Git host on the AT Protocol — git transport ' +
      'works normally via git-mcp tools, but there is no PR/MR surface.',
    needsRepoPath: true,
    check: repoPath => checkTangled(repoPath as string),
  });

  registerCheckTool(server, {
    name: 'git_entire_check',
    title: 'Check Entire Availability',
    description:
      'Detect whether the Entire CLI is available and whether the repository is Entire-managed ' +
      '(has a .entire/ directory). When managed, agents should use the `entire` CLI for session, ' +
      "checkpoint, and attribution queries; git-mcp tools do not expose Entire's context layer.",
    needsRepoPath: true,
    check: repoPath => checkEntire(repoPath as string),
  });
}
