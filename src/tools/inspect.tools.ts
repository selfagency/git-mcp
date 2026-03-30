import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import {
  blameFile,
  getDiff,
  getDiffSummary,
  getLog,
  getReflog,
  getStatus,
  showRef,
} from '../services/inspect.service.js';

function toText(content: unknown, responseFormat: 'markdown' | 'json'): string {
  if (responseFormat === 'json') {
    return JSON.stringify(content, null, 2);
  }

  return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
}

export function registerInspectTools(server: McpServer): void {
  server.registerTool(
    'git_status',
    {
      title: 'Git Status',
      description: 'Get repository working tree and branch status.',
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
      try {
        const repoPath = resolveRepoPath(repo_path);
        const status = await getStatus(repoPath);
        return {
          content: [{ type: 'text', text: toText(status, response_format) }],
          structuredContent: { status },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_log',
    {
      title: 'Git Log',
      description: 'Get commit history with optional filters and pagination.',
      inputSchema: {
        repo_path: RepoPathSchema,
        limit: z.number().int().min(1).max(200).default(30),
        offset: z.number().int().min(0).default(0),
        author: z.string().optional(),
        grep: z.string().optional(),
        since: z.string().optional(),
        until: z.string().optional(),
        file_path: z.string().optional(),
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
      limit,
      offset,
      author,
      grep,
      since,
      until,
      file_path,
      response_format,
    }: {
      repo_path: string | undefined;
      limit: number;
      offset: number;
      author?: string;
      grep?: string;
      since?: string;
      until?: string;
      file_path?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const commits = await getLog(repoPath, {
          limit,
          offset,
          author,
          grep,
          since,
          until,
          filePath: file_path,
        });

        return {
          content: [{ type: 'text', text: toText(commits, response_format) }],
          structuredContent: { commits },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_show',
    {
      title: 'Git Show',
      description: 'Show patch and metadata for a commit, tag, or ref.',
      inputSchema: {
        repo_path: RepoPathSchema,
        ref: z.string().min(1),
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
      ref,
      response_format,
    }: {
      repo_path: string | undefined;
      ref: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await showRef(repoPath, ref);
        return {
          content: [{ type: 'text', text: toText(output, response_format) }],
          structuredContent: { ref, output },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_diff',
    {
      title: 'Git Diff',
      description: 'Show unstaged, staged, or ref-to-ref diff. Supports optional LLM-oriented filtering.',
      inputSchema: {
        repo_path: RepoPathSchema,
        mode: z.enum(['unstaged', 'staged', 'refs']).default('unstaged'),
        from_ref: z.string().optional(),
        to_ref: z.string().optional(),
        filtered: z.boolean().default(false),
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
      mode,
      from_ref,
      to_ref,
      filtered,
      response_format,
    }: {
      repo_path: string | undefined;
      mode: 'unstaged' | 'staged' | 'refs';
      from_ref?: string;
      to_ref?: string;
      filtered: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const [summary, output] = await Promise.all([
          getDiffSummary(repoPath, {
            mode,
            fromRef: from_ref,
            toRef: to_ref,
            filtered,
          }),
          getDiff(repoPath, {
            mode,
            fromRef: from_ref,
            toRef: to_ref,
            filtered,
          }),
        ]);

        const payload = { summary, output };
        return {
          content: [{ type: 'text', text: toText(payload, response_format) }],
          structuredContent: payload,
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_blame',
    {
      title: 'Git Blame',
      description: 'Show line-level author attribution for a file.',
      inputSchema: {
        repo_path: RepoPathSchema,
        file_path: z.string().min(1),
        ref: z.string().optional(),
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
      file_path,
      ref,
      response_format,
    }: {
      repo_path: string | undefined;
      file_path: string;
      ref?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await blameFile(repoPath, file_path, ref);
        return {
          content: [{ type: 'text', text: toText(output, response_format) }],
          structuredContent: { file_path, ref, output },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );

  server.registerTool(
    'git_reflog',
    {
      title: 'Git Reflog',
      description: 'Show local HEAD and ref movement history for recovery.',
      inputSchema: {
        repo_path: RepoPathSchema,
        limit: z.number().int().min(1).max(200).default(30),
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
      limit,
      response_format,
    }: {
      repo_path: string | undefined;
      limit: number;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await getReflog(repoPath, limit);
        return {
          content: [{ type: 'text', text: toText(output, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );
}
