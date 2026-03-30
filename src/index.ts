#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { registerGitResources } from './resources/git.resources.js';
import { registerAdvancedTools } from './tools/advanced.tools.js';
import { registerBranchTools } from './tools/branch.tools.js';
import { registerContextTools } from './tools/context.tools.js';
import { registerInspectTools } from './tools/inspect.tools.js';
import { registerRemoteTools } from './tools/remote.tools.js';
import { registerWriteTools } from './tools/write.tools.js';

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

registerInspectTools(server);
registerWriteTools(server);
registerBranchTools(server);
registerRemoteTools(server);
registerAdvancedTools(server);
registerContextTools(server);
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Server startup failed: ${message}`);
  process.exit(1);
});
