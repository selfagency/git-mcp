import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import {
  checkoutRef,
  createBranch,
  deleteBranch,
  listBranches,
  renameBranch,
  setUpstream,
} from '../services/branch.service.js';
import { renderContent } from './render.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

export function registerBranchTools(server: McpServer): void {
  server.registerTool(
    'git_list_branches',
    {
      title: 'List Git Branches',
      description: 'List local branches, or all branches including remotes.',
      inputSchema: {
        repo_path: RepoPathSchema,
        all: z.boolean().default(false),
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
      all,
      response_format,
    }: {
      repo_path: string | undefined;
      all: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const branches = await listBranches(repoPath, all);
        return {
          content: [{ type: 'text', text: render({ branches }, response_format) }],
          structuredContent: { branches },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_create_branch',
    {
      title: 'Create Git Branch',
      description: 'Create a branch from current HEAD or an explicit ref.',
      inputSchema: {
        repo_path: RepoPathSchema,
        name: z.string().min(1),
        from_ref: z.string().optional(),
        checkout: z.boolean().default(false),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      name,
      from_ref,
      checkout,
      response_format,
    }: {
      repo_path: string | undefined;
      name: string;
      from_ref?: string;
      checkout: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const message = await createBranch(repoPath, {
          name,
          fromRef: from_ref,
          checkout,
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

  server.registerTool(
    'git_delete_branch',
    {
      title: 'Delete Git Branch',
      description: 'Delete a local branch.',
      inputSchema: {
        repo_path: RepoPathSchema,
        name: z.string().min(1),
        force: z.boolean().default(false),
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
      name,
      force,
      response_format,
    }: {
      repo_path: string | undefined;
      name: string;
      force: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const message = await deleteBranch(repoPath, { name, force });
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
    'git_rename_branch',
    {
      title: 'Rename Git Branch',
      description: 'Rename an existing branch.',
      inputSchema: {
        repo_path: RepoPathSchema,
        old_name: z.string().min(1),
        new_name: z.string().min(1),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      old_name,
      new_name,
      response_format,
    }: {
      repo_path: string | undefined;
      old_name: string;
      new_name: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const message = await renameBranch(repoPath, old_name, new_name);
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
    'git_checkout',
    {
      title: 'Git Checkout',
      description: 'Checkout a branch, tag, or commit; optionally create a new local branch.',
      inputSchema: {
        repo_path: RepoPathSchema,
        ref: z.string().min(1),
        create: z.boolean().default(false),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      ref,
      create,
      response_format,
    }: {
      repo_path: string | undefined;
      ref: string;
      create: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const message = await checkoutRef(repoPath, ref, create);
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
    'git_set_upstream',
    {
      title: 'Set Branch Upstream',
      description: 'Set the upstream tracking branch for a local branch.',
      inputSchema: {
        repo_path: RepoPathSchema,
        branch: z.string().min(1),
        upstream: z.string().min(1),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      branch,
      upstream,
      response_format,
    }: {
      repo_path: string | undefined;
      branch: string;
      upstream: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const message = await setUpstream(repoPath, branch, upstream);
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
