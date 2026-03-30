import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { runFlowAction } from '../services/flow.service.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }
  return JSON.stringify(content, null, 2);
}

const FLOW_ACTION_VALUES = [
  'init',
  'feature-start',
  'feature-finish',
  'feature-publish',
  'feature-list',
  'release-start',
  'release-finish',
  'release-publish',
  'release-list',
  'hotfix-start',
  'hotfix-finish',
  'hotfix-list',
  'support-start',
  'support-list',
] as const;

export function registerFlowTools(server: McpServer): void {
  server.registerTool(
    'git_flow',
    {
      title: 'Git Flow Actions',
      description:
        'Implements the git-flow branching model without requiring the git-flow CLI extension. ' +
        'Supports feature, release, hotfix, and support branches. ' +
        'Use "init" first to configure branch names and prefixes in local git config. ' +
        'Branch names (main/develop) and prefixes are read from gitflow.* config with sensible defaults. ' +
        'Actions: init — set up flow config and develop branch. ' +
        'feature-start/finish/publish/list — manage feature branches off develop. ' +
        'release-start/finish/publish/list — manage release branches; finish merges to main+develop and tags. ' +
        'hotfix-start/finish/list — manage hotfix branches off main; finish merges to main+develop and tags. ' +
        'support-start/list — create long-lived support branches off main.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(FLOW_ACTION_VALUES),
        name: z
          .string()
          .optional()
          .describe('Feature/release/hotfix/support name or version (e.g. "my-feature", "1.2.0").'),
        main_branch: z
          .string()
          .optional()
          .describe('Override the main branch name (default: gitflow.branch.master config or "main").'),
        develop_branch: z
          .string()
          .optional()
          .describe('Override the develop branch name (default: gitflow.branch.develop config or "develop").'),
        remote: z.string().optional().describe('Remote name for publish operations (default: "origin").'),
        tag: z
          .boolean()
          .default(true)
          .describe('Create an annotated tag when finishing a release or hotfix (default: true).'),
        tag_message: z.string().optional().describe('Message for the version tag.'),
        delete_branch: z
          .boolean()
          .default(true)
          .describe('Delete the branch after a finish operation (default: true).'),
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
      action,
      name,
      main_branch,
      develop_branch,
      remote,
      tag,
      tag_message,
      delete_branch,
      response_format,
    }: {
      repo_path: string | undefined;
      action: (typeof FLOW_ACTION_VALUES)[number];
      name?: string;
      main_branch?: string;
      develop_branch?: string;
      remote?: string;
      tag: boolean;
      tag_message?: string;
      delete_branch: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const output = await runFlowAction(repoPath, {
          action,
          name,
          mainBranch: main_branch,
          developBranch: develop_branch,
          remote,
          tag,
          tagMessage: tag_message,
          deleteBranch: delete_branch,
        });
        return {
          content: [{ type: 'text', text: render({ output }, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        const gitError = toGitError(error);
        return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
      }
    },
  );
}
