import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { fetchRemote, listRemotes, manageRemote, pullRemote, pushRemote } from '../services/remote.service.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

export function registerRemoteTools(server: McpServer): void {
  server.registerTool(
    'git_list_remotes',
    {
      title: 'List Git Remotes',
      description: 'List configured repository remotes with fetch and push URLs.',
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
        const remotes = await listRemotes(repo_path);
        return {
          content: [{ type: 'text', text: render({ remotes }, response_format) }],
          structuredContent: { remotes },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_remote',
    {
      title: 'Manage Git Remotes',
      description: 'Add, remove, or set URL for remotes using action-based input.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['add', 'remove', 'set-url']),
        name: z.string().min(1),
        url: z.string().optional(),
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
      name,
      url,
      response_format,
    }: {
      repo_path: string;
      action: 'add' | 'remove' | 'set-url';
      name: string;
      url?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await manageRemote(repo_path, { action, name, url });
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_fetch',
    {
      title: 'Git Fetch',
      description: 'Fetch updates from remote with optional pruning.',
      inputSchema: {
        repo_path: RepoPathSchema,
        remote: z.string().optional(),
        branch: z.string().optional(),
        prune: z.boolean().default(true),
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
      remote,
      branch,
      prune,
      response_format,
    }: {
      repo_path: string;
      remote?: string;
      branch?: string;
      prune: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await fetchRemote(repo_path, { remote, branch, prune });
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_pull',
    {
      title: 'Git Pull',
      description: 'Pull from remote with merge (default) or rebase mode.',
      inputSchema: {
        repo_path: RepoPathSchema,
        remote: z.string().optional(),
        branch: z.string().optional(),
        rebase: z.boolean().default(false),
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
      remote,
      branch,
      rebase,
      response_format,
    }: {
      repo_path: string;
      remote?: string;
      branch?: string;
      rebase: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await pullRemote(repo_path, { remote, branch, rebase });
        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_push',
    {
      title: 'Git Push',
      description: 'Push to remote with safe force option (`--force-with-lease`).',
      inputSchema: {
        repo_path: RepoPathSchema,
        remote: z.string().optional(),
        branch: z.string().optional(),
        set_upstream: z.boolean().default(false),
        force_with_lease: z.boolean().default(false),
        tags: z.boolean().default(false),
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
      remote,
      branch,
      set_upstream,
      force_with_lease,
      tags,
      response_format,
    }: {
      repo_path: string;
      remote?: string;
      branch?: string;
      set_upstream: boolean;
      force_with_lease: boolean;
      tags: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const message = await pushRemote(repo_path, {
          remote,
          branch,
          setUpstream: set_upstream,
          forceWithLease: force_with_lease,
          tags,
        });

        return {
          content: [{ type: 'text', text: render({ message }, response_format) }],
          structuredContent: { message },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );
}
