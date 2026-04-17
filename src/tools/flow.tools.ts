import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import {
  FlowBranchKindSchema,
  FlowConfigActionSchema,
  FlowConfigScopeSchema,
  FlowControlActionSchema,
  FlowMatchModeSchema,
  FlowMergeStrategySchema,
  FlowPresetSchema,
  FlowTopicActionSchema,
  RepoPathSchema,
  ResponseFormatSchema,
} from '../schemas/index.js';
import { runFlowAction, type FlowLegacyAction, type FlowOperation } from '../services/flow.service.js';
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
        'Implements git-flow-next-style workflows directly, without requiring the ' +
        'external CLI. The canonical contract uses operation=config/topic/control ' +
        'with subactions, while legacy alias actions remain supported for ' +
        'compatibility. Supports preset init, overview, config CRUD, generalized ' +
        'topic lifecycle operations, and finish recovery.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(FLOW_ACTION_VALUES).optional().describe('Legacy-compatible action alias.'),
        operation: z.enum(FLOW_OPERATION_VALUES).optional().describe('Canonical git_flow operation.'),
        config_action: FlowConfigActionSchema.optional(),
        topic_action: FlowTopicActionSchema.optional(),
        control_action: FlowControlActionSchema.optional(),
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
        pattern: z
          .string()
          .optional()
          .describe('Optional glob pattern used by list actions to filter topic branch names.'),
        match_mode: FlowMatchModeSchema.optional(),
        branch_kind: FlowBranchKindSchema.optional(),
        parent: z.string().optional().describe('Parent/base branch for flow config mutations.'),
        prefix: z.string().optional().describe('Branch prefix for topic type definitions, such as "feature/".'),
        start_point: z.string().optional().describe('Configured start point for a topic type.'),
        base_ref: z.string().optional().describe('Explicit starting ref for topic-start.'),
        preset: FlowPresetSchema.optional(),
        scope: FlowConfigScopeSchema.optional(),
        config_file: z.string().optional().describe('Path to a git config file when scope is "file".'),
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
        staging_branch: z.string().optional().describe('Override the staging branch name used by the gitlab preset.'),
        production_branch: z
          .string()
          .optional()
          .describe('Override the production branch name used by the gitlab preset.'),
        remote: z.string().optional().describe('Remote name for publish operations (default: "origin").'),
        upstream_strategy: FlowMergeStrategySchema.optional(),
        downstream_strategy: FlowMergeStrategySchema.optional(),
        strategy: FlowMergeStrategySchema.optional().describe('Integration strategy for finish/update operations.'),
        fetch: z.boolean().optional().describe('Fetch the remote before finish when a remote is configured.'),
        ff: z.boolean().optional().describe('Use fast-forward behavior when the selected strategy allows it.'),
        keep_branch: z.boolean().optional().describe('Keep the topic branch after finish.'),
        no_backmerge: z.boolean().default(false).describe('Skip configured backmerge branches during finish.'),
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
      operation,
      config_action,
      topic_action,
      control_action,
      topic,
      name,
      new_name,
      pattern,
      match_mode,
      branch_kind,
      parent,
      prefix,
      start_point,
      base_ref,
      preset,
      scope,
      config_file,
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
      no_backmerge,
      rebase_before_finish,
      preserve_merges,
      publish,
      force_delete,
      auto_update,
      tag,
      tag_message,
      tag_prefix,
      delete_branch,
      response_format,
    }: {
      repo_path: string | undefined;
      action?: (typeof FLOW_ACTION_VALUES)[number];
      operation?: FlowOperation;
      config_action?: 'list' | 'add' | 'update' | 'rename' | 'delete';
      topic_action?: 'start' | 'finish' | 'publish' | 'list' | 'update' | 'delete' | 'rename' | 'checkout' | 'track';
      control_action?: 'continue' | 'abort';
      topic?: string;
      name?: string;
      new_name?: string;
      pattern?: string;
      match_mode?: 'exact' | 'prefix';
      branch_kind?: 'base' | 'topic';
      parent?: string;
      prefix?: string;
      start_point?: string;
      base_ref?: string;
      preset?: 'classic' | 'github' | 'gitlab';
      scope?: 'local' | 'global' | 'system' | 'file';
      config_file?: string;
      force: boolean;
      no_create_branches: boolean;
      main_branch?: string;
      develop_branch?: string;
      staging_branch?: string;
      production_branch?: string;
      remote?: string;
      upstream_strategy?: 'merge' | 'rebase' | 'squash' | 'none';
      downstream_strategy?: 'merge' | 'rebase' | 'squash' | 'none';
      strategy?: 'merge' | 'rebase' | 'squash' | 'none';
      fetch?: boolean;
      ff?: boolean;
      keep_branch?: boolean;
      no_backmerge: boolean;
      rebase_before_finish?: boolean;
      preserve_merges?: boolean;
      publish?: boolean;
      force_delete?: boolean;
      auto_update?: boolean;
      tag: boolean;
      tag_message?: string;
      tag_prefix?: string;
      delete_branch: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const result = await runFlowAction(repoPath, {
          action: action as FlowLegacyAction | undefined,
          operation,
          configAction: config_action,
          topicAction: topic_action,
          controlAction: control_action,
          topic,
          name,
          newName: new_name,
          pattern,
          matchMode: match_mode,
          branchKind: branch_kind,
          parent,
          prefix,
          startPoint: start_point,
          baseRef: base_ref,
          preset,
          scope,
          configFile: config_file,
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
          noBackmerge: no_backmerge,
          rebaseBeforeFinish: rebase_before_finish,
          preserveMerges: preserve_merges,
          publish,
          forceDelete: force_delete,
          autoUpdate: auto_update,
          tag,
          tagMessage: tag_message,
          tagPrefix: tag_prefix,
          deleteBranch: delete_branch,
        });

        const structuredContent: Record<string, unknown> =
          result.data && typeof result.data === 'object' && !Array.isArray(result.data)
            ? (result.data as Record<string, unknown>)
            : { output: result.data ?? result.markdown };

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
