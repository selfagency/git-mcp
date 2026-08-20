import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import {
  createBackup,
  restoreBackup,
  rewordCommit,
  rewriteMessages,
  squashCommits,
} from '../services/rewrite.service.js';
import { renderContent } from './render.js';
import { buildToolError } from '../utils/error-response.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  return renderContent(content, format);
}

function buildError(error: unknown): ReturnType<typeof buildToolError> {
  return buildToolError(error);
}

interface RewriteActionInput {
  repoPath: string;
  action: RewriteActionName;
  ref?: string;
  message?: string;
  count?: number;
  range?: string;
  messages?: Record<string, string>;
  name?: string;
  confirm: boolean;
}

type RewriteActionName = 'reword' | 'squash' | 'rewrite-messages' | 'backup' | 'restore';

interface RewriteActionSpec {
  readonly confirm: boolean;
  readonly required: readonly (keyof RewriteActionInput)[];
  readonly run: (input: RewriteActionInput) => Promise<unknown>;
}

const REWRITE_ACTIONS: Record<RewriteActionName, RewriteActionSpec> = {
  backup: {
    confirm: false,
    required: ['name'],
    run: input => createBackup(input.repoPath, { name: input.name! }),
  },
  restore: {
    confirm: true,
    required: ['name'],
    run: input => restoreBackup(input.repoPath, { name: input.name! }),
  },
  reword: {
    confirm: true,
    required: ['message'],
    run: input => rewordCommit(input.repoPath, { ref: input.ref, message: input.message! }),
  },
  squash: {
    confirm: true,
    required: ['message', 'count'],
    run: input => squashCommits(input.repoPath, { count: input.count!, message: input.message! }),
  },
  'rewrite-messages': {
    confirm: true,
    required: ['range'],
    run: input => {
      if (!input.messages || Object.keys(input.messages).length === 0) {
        throw new Error('messages mapping is required for rewrite-messages.');
      }
      return rewriteMessages(input.repoPath, { range: input.range!, messages: input.messages });
    },
  },
};

const REWRITE_CONFIRM_REQUIREMENTS: Record<RewriteActionName, string> = {
  backup: '',
  restore: 'restore requires confirm=true because it performs a hard reset.',
  reword: 'reword requires confirm=true because it rewrites history.',
  squash: 'squash requires confirm=true because it rewrites history.',
  'rewrite-messages': 'rewrite-messages requires confirm=true because it rewrites history.',
};

function runRewriteAction(input: RewriteActionInput): Promise<unknown> {
  const spec = REWRITE_ACTIONS[input.action];
  for (const field of spec.required) {
    if (!input[field]) {
      throw new Error(`${field} is required for ${input.action}.`);
    }
  }
  if (spec.confirm && !input.confirm) {
    throw new Error(REWRITE_CONFIRM_REQUIREMENTS[input.action]);
  }
  return spec.run(input);
}

export function registerRewriteTools(server: McpServer): void {
  server.registerTool(
    'git_rewrite',
    {
      title: 'Git History Rewrite',
      description:
        'Rewrite commit history. Use action=reword|squash|rewrite-messages|backup|restore. ' +
        'History rewriting changes commit hashes and requires force-push; create a backup first.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z
          .enum(['reword', 'squash', 'rewrite-messages', 'backup', 'restore'])
          .describe('History rewrite operation.'),
        ref: z.string().optional().describe('Commit ref to reword (defaults to HEAD).'),
        message: z.string().optional().describe('New commit message (reword/squash).'),
        count: z.number().int().min(2).optional().describe('Number of commits to squash.'),
        range: z.string().optional().describe('Commit range to rewrite (e.g. HEAD~5..HEAD).'),
        messages: z
          .record(z.string(), z.string())
          .optional()
          .describe('Map of commit SHA to replacement message (rewrite-messages).'),
        name: z.string().optional().describe('Backup branch name (backup/restore).'),
        confirm: z.boolean().default(false).describe('Confirm destructive history rewrite.'),
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
      ref,
      message,
      count,
      range,
      messages,
      name,
      confirm,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'reword' | 'squash' | 'rewrite-messages' | 'backup' | 'restore';
      ref?: string;
      message?: string;
      count?: number;
      range?: string;
      messages?: Record<string, string>;
      name?: string;
      confirm: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runRewriteAction({
          repoPath,
          action,
          ref,
          message,
          count,
          range,
          messages,
          name,
          confirm,
        });
        return {
          content: [{ type: 'text', text: render(output, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}
