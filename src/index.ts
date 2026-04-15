#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  ALLOW_FORCE_PUSH,
  ALLOW_FLOW_HOOKS,
  ALLOW_NO_VERIFY,
  AUTO_SIGN_COMMITS,
  AUTO_SIGN_TAGS,
  DEFAULT_REPO_PATH,
  DEFAULT_SIGNING_KEY,
} from './config.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { registerGitResources } from './resources/git.resources.js';
import { registerDocsTools } from './tools/docs.tools.js';
import { registerFlowTools } from './tools/flow.tools.js';
import { registerGroupedTools } from './tools/grouped.tools.js';
import { registerLfsTools } from './tools/lfs.tools.js';

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

registerGroupedTools(server);
registerLfsTools(server);
registerFlowTools(server);
registerDocsTools(server);
registerGitResources(server);

server.registerTool(
  'git_ping',
  {
    title: 'Git MCP Ping',
    description: 'Returns a simple response to verify the server is running.',
    inputSchema: {
      message: z.string().default('pong'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ message }: { message: string }) => {
    return {
      content: [{ type: 'text', text: `git-mcp-server: ${message}` }],
      structuredContent: {
        ok: true,
        message,
      },
    };
  },
);

async function main(): Promise<void> {
  if (DEFAULT_REPO_PATH) {
    console.error(`[git-mcp] default repository path: ${DEFAULT_REPO_PATH}`);
  }
  if (ALLOW_NO_VERIFY) console.error('[git-mcp] hook bypass enabled (GIT_ALLOW_NO_VERIFY=true)');
  if (ALLOW_FORCE_PUSH) console.error('[git-mcp] force push enabled (GIT_ALLOW_FORCE_PUSH=true)');
  if (ALLOW_FLOW_HOOKS) console.error('[git-mcp] git_flow hooks/filters enabled (GIT_ALLOW_FLOW_HOOKS=true)');
  if (AUTO_SIGN_COMMITS) console.error('[git-mcp] auto-signing commits (GIT_AUTO_SIGN_COMMITS=true)');
  if (AUTO_SIGN_TAGS) console.error('[git-mcp] auto-signing tags (GIT_AUTO_SIGN_TAGS=true)');
  if (DEFAULT_SIGNING_KEY) console.error(`[git-mcp] signing key: ${DEFAULT_SIGNING_KEY}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Server startup failed: ${message}`);
  process.exit(1);
});
