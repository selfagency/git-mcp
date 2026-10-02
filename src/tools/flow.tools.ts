import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import {
  FlowBranchKindSchema,
  FlowConfigScopeSchema,
  FlowControlActionSchema,
  FlowMergeStrategySchema,
  FlowPresetSchema,
  FlowTopicActionSchema,
  RepoPathSchema,
  ResponseFormatSchema,
} from '../schemas/index.js';
import { runFlowAction } from '../services/flow.service.js';
import type {
  FlowBranchKind,
  FlowConfigAction,
  FlowControlAction,
  FlowMergeStrategy,
  FlowOperation,
  FlowPreset,
  FlowScope,
  FlowTopicAction,
} from '../types.js';
import { renderMarkdownData } from './render.js';

function render(markdown: string, data: unknown, format: 'markdown' | 'json'): string {
  return renderMarkdownData(markdown, data, format);
}

const FLOW_ACTION_VALUES = [
  'init',
  'overview',
  'config-list',
  'config-add',
  'config-update',
  'config-rename',
  'config-delete',
  'topic-finish',
  'topic-list',
  'topic-start',
  'topic-publish',
  'topic-update',
  'topic-delete',
  'topic-rename',
  'topic-checkout',
  'topic-track',
  'control-continue',
  'control-abort',
  'feature-start',
  'feature-finish',
  'feature-publish',
  'feature-list',
  'feature-update',
  'feature-delete',
  'feature-rename',
  'feature-checkout',
  'feature-track',
  'release-start',
  'release-finish',
  'release-publish',
  'release-list',
  'release-update',
  'release-delete',
  'release-rename',
  'release-checkout',
  'release-track',
  'hotfix-start',
  'hotfix-finish',
  'hotfix-publish',
  'hotfix-list',
  'hotfix-update',
  'hotfix-delete',
  'hotfix-rename',
  'hotfix-checkout',
  'hotfix-track',
  'support-start',
  'support-list',
  'support-finish',
  'support-publish',
  'support-update',
  'support-delete',
  'support-rename',
  'support-checkout',
  'support-track',
] as const;

const FLOW_OPERATION_VALUES = ['init', 'overview', 'config', 'topic', 'control'] as const;

export function registerFlowTools(server: McpServer): void {
  server.registerTool(
    'git_flow',
    {
      title: 'Git Flow Actions',
      description:
        'Drives the git-flow-next CLI. The CLI owns the workflow semantics — the finish ' +
        'state machine, conflict recovery, and worktree lifecycle — so it must be installed ' +
        'and on PATH; this tool only builds argv. Prefer operation=config/topic/control with ' +
        'subactions; the legacy action aliases remain for compatibility.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(FLOW_ACTION_VALUES).optional().describe('Legacy-compatible action alias.'),
        operation: z.enum(FLOW_OPERATION_VALUES).optional().describe('Canonical git_flow operation.'),
        config_action: z
          .enum(['list', 'add', 'update', 'rename', 'delete', 'status', 'sync'])
          .optional()
          .describe('config_action is required for operation=config.'),
        topic_action: FlowTopicActionSchema.optional(),
        control_action: FlowControlActionSchema.optional(),
        recover: z
          .enum(['finish', 'update'])
          .default('finish')
          .describe('Which in-progress operation control_action targets (default: finish).'),
        topic: z
          .string()
          .optional()
          .describe(
            'Topic branch type for generalized actions such as topic-start, ' + 'topic-list, or topic-publish.',
          ),
        name: z
          .string()
          .optional()
          .describe('Branch short name, branch type name, or release/hotfix version depending on the action.'),
        new_name: z.string().optional().describe('New short name or branch type name for rename operations.'),
        branch_kind: FlowBranchKindSchema.optional(),
        parent: z.string().optional().describe('Parent/base branch for flow config mutations.'),
        prefix: z.string().optional().describe('Branch prefix for topic type definitions, such as "feature/".'),
        start_point: z.string().optional().describe('Configured start point for a topic type.'),
        base_ref: z.string().optional().describe('Explicit starting ref for topic-start.'),
        preset: FlowPresetSchema.optional(),
        scope: FlowConfigScopeSchema.optional(),
        config_file: z.string().optional().describe('Path to a git config file when scope is "file".'),
        shared: z.boolean().default(false).describe('Write a committable .gitflow file (init, or config edit).'),
        force: z.boolean().default(false).describe('Force re-initialization even if git-flow is already configured.'),
        no_create_branches: z
          .boolean()
          .default(false)
          .describe('Skip base branch creation during init and only write configuration.'),
        main_branch: z
          .string()
          .optional()
          .describe('Override the main branch name (default: gitflow.branch.master config or "main").'),
        develop_branch: z
          .string()
          .optional()
          .describe('Override the develop branch name (default: gitflow.branch.develop ' + 'config or "develop").'),
        staging_branch: z
          .string()
          .optional()
          .describe('NOT SUPPORTED by git-flow-next 2.1.0 init; use preset=gitlab instead.'),
        production_branch: z
          .string()
          .optional()
          .describe('NOT SUPPORTED by git-flow-next 2.1.0 init; use preset=gitlab instead.'),
        remote: z.string().optional().describe('Remote name for publish operations (default: "origin").'),
        upstream_strategy: FlowMergeStrategySchema.optional(),
        downstream_strategy: FlowMergeStrategySchema.optional(),
        strategy: FlowMergeStrategySchema.optional().describe('Integration strategy for finish/update operations.'),
        fetch: z.boolean().optional().describe('Fetch the remote before finish when a remote is configured.'),
        ff: z.boolean().optional().describe('Use fast-forward behavior when the selected strategy allows it.'),
        keep_branch: z.boolean().optional().describe('Keep the topic branch after finish.'),
        rebase_before_finish: z
          .boolean()
          .optional()
          .describe('Rebase the topic branch onto its parent before finishing.'),
        preserve_merges: z.boolean().optional().describe('Preserve merges during rebase-based finish flows.'),
        publish: z.boolean().optional().describe('Publish parent/backmerge branches after finish.'),
        force_delete: z.boolean().optional().describe('Force deletion for topic-delete and config flags.'),
        auto_update: z.boolean().optional().describe('Enable auto-update on base branch definitions.'),
        tag: z
          .boolean()
          .default(true)
          .describe('Create an annotated tag when finishing a release or hotfix (default: true).'),
        tag_message: z.string().optional().describe('Message for the version tag.'),
        tag_prefix: z.string().optional().describe('Tag prefix for flow config mutations.'),
        worktree: z
          .boolean()
          .optional()
          .describe(
            'Worktree handling for the branch. finish/delete expose only --keep-worktree and ' +
              '--force-worktree; start and checkout expose --worktree/--no-worktree/--worktree-path. ' +
              'Using the wrong pair raises rather than being silently ignored.',
          ),
        worktrees: z
          .boolean()
          .default(false)
          .describe('Append a worktree column to a list (only valid with topic_action=list).'),
        worktree_path: z.string().optional().describe('Create the worktree at this path instead of the computed one.'),
        keep_worktree: z
          .boolean()
          .default(false)
          .describe('On finish/delete, keep the branch worktree detached instead of removing it.'),
        force_worktree: z
          .boolean()
          .default(false)
          .describe('On finish/delete, remove a git-flow-created worktree even with uncommitted changes.'),
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
      operation,
      config_action,
      topic_action,
      control_action,
      recover,
      topic,
      name,
      new_name,
      branch_kind,
      parent,
      prefix,
      start_point,
      base_ref,
      preset,
      scope,
      config_file,
      shared,
      force,
      no_create_branches,
      main_branch,
      develop_branch,
      staging_branch,
      production_branch,
      remote,
      upstream_strategy,
      downstream_strategy,
      strategy,
      fetch,
      ff,
      keep_branch,
      rebase_before_finish,
      preserve_merges,
      publish,
      force_delete,
      auto_update,
      tag,
      tag_message,
      tag_prefix,
      worktree,
      worktrees,
      worktree_path,
      keep_worktree,
      force_worktree,
      response_format,
    }: {
      repo_path: string | undefined;
      action?: (typeof FLOW_ACTION_VALUES)[number];
      operation?: FlowOperation;
      config_action?: FlowConfigAction;
      topic_action?: FlowTopicAction;
      control_action?: FlowControlAction;
      recover?: 'finish' | 'update';
      topic?: string;
      name?: string;
      new_name?: string;
      branch_kind?: FlowBranchKind;
      parent?: string;
      prefix?: string;
      start_point?: string;
      base_ref?: string;
      preset?: FlowPreset;
      scope?: FlowScope;
      config_file?: string;
      shared: boolean;
      force: boolean;
      no_create_branches: boolean;
      main_branch?: string;
      develop_branch?: string;
      staging_branch?: string;
      production_branch?: string;
      remote?: string;
      upstream_strategy?: FlowMergeStrategy;
      downstream_strategy?: FlowMergeStrategy;
      strategy?: FlowMergeStrategy;
      fetch?: boolean;
      ff?: boolean;
      keep_branch?: boolean;
      rebase_before_finish?: boolean;
      preserve_merges?: boolean;
      publish?: boolean;
      force_delete?: boolean;
      auto_update?: boolean;
      tag: boolean;
      tag_message?: string;
      tag_prefix?: string;
      worktree?: boolean;
      worktrees: boolean;
      worktree_path?: string;
      keep_worktree: boolean;
      force_worktree: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const result = await runFlowAction(repoPath, {
          legacyAction: action,
          operation,
          configAction: config_action,
          topicAction: topic_action,
          controlAction: control_action,
          recover: recover,
          topic,
          name,
          newName: new_name,
          branchKind: branch_kind,
          parent,
          prefix,
          startPoint: start_point,
          baseRef: base_ref,
          preset,
          scope,
          configFile: config_file,
          shared,
          force,
          noCreateBranches: no_create_branches,
          mainBranch: main_branch,
          developBranch: develop_branch,
          stagingBranch: staging_branch,
          productionBranch: production_branch,
          remote,
          upstreamStrategy: upstream_strategy,
          downstreamStrategy: downstream_strategy,
          strategy,
          fetch,
          ff,
          keepBranch: keep_branch,
          rebaseBeforeFinish: rebase_before_finish,
          preserveMerges: preserve_merges,
          publish,
          forceDelete: force_delete,
          autoUpdate: auto_update,
          tag,
          tagMessage: tag_message,
          tagPrefix: tag_prefix,
          worktree,
          worktrees,
          worktreePath: worktree_path,
          keepWorktree: keep_worktree,
          forceWorktree: force_worktree,
        });

        const structuredContent: Record<string, unknown> = { output: result.markdown };

        return {
          content: [
            {
              type: 'text',
              text: render(result.markdown, structuredContent, response_format),
            },
          ],
          structuredContent,
        };
      } catch (error) {
        const gitError = toGitError(error);
        return {
          content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }],
        };
      }
    },
  );
}
