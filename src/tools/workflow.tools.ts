import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveRepoPath } from '../config.js';
import { toGitError } from '../git/client.js';
import {
  RepoPathSchema,
  ResponseFormatSchema,
  WorkflowLifecycleActionSchema,
  WorkflowNameSchema,
} from '../schemas/index.js';
import { runWorkflowAction } from '../services/workflow.service.js';

function render(markdown: string, data: unknown, format: 'markdown' | 'json'): string {
  if (format === 'markdown') {
    return markdown;
  }

  return JSON.stringify(data, null, 2);
}

export function registerWorkflowTools(server: McpServer): void {
  server.registerTool(
    'git_workflow',
    {
      title: 'Git Workflow Orchestrator',
      description:
        'Run named multi-step Git workflows with resumable lifecycle controls. ' +
        'Use action=start|status|continue|abort|list with workflow families such as ' +
        'snapshot, replay, branch_surgery, and publish.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: WorkflowLifecycleActionSchema,
        workflow: WorkflowNameSchema.optional(),
        base_branch: z.string().optional().describe('Base branch for snapshot merge-base checks (default: main).'),
        log_count: z.number().int().min(1).max(100).default(12).describe('Commit count for snapshot log output.'),
        mode: z.enum(['cherry-pick', 'am']).default('cherry-pick').describe('Replay mode for replay workflow.'),
        target_branch: z.string().optional().describe('Target branch for replay/branch_surgery/publish workflows.'),
        source_commits: z.array(z.string()).optional().describe('Commit list for replay and branch_surgery flows.'),
        patch_files: z.array(z.string()).optional().describe('Patch/mailbox file list for replay mode=am.'),
        three_way: z.boolean().default(true).describe('Use --3way when applying patch series via git am.'),
        backup_branch: z.string().optional().describe('Backup branch name for branch_surgery workflow.'),
        reset_to: z.string().optional().describe('Optional hard-reset target in replay/branch_surgery workflows.'),
        confirm_hard_reset: z
          .boolean()
          .default(false)
          .describe('Required true when reset_to is provided because hard reset is destructive.'),
        publish: z.boolean().default(false).describe('Publish after replay/branch_surgery sequence.'),
        remote: z.string().optional().describe('Remote name for publish-related steps (default: origin).'),
        force_with_lease: z.boolean().default(false).describe('Use --force-with-lease for publish push steps.'),
        set_upstream: z.boolean().default(false).describe('Use --set-upstream for publish push steps.'),
        fetch_first: z.boolean().default(true).describe('Fetch before publish workflow steps.'),
        rebase_onto: z.string().optional().describe('Optional rebase target before publish push step.'),
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
      action,
      workflow,
      base_branch,
      log_count,
      mode,
      target_branch,
      source_commits,
      patch_files,
      three_way,
      backup_branch,
      reset_to,
      confirm_hard_reset,
      publish,
      remote,
      force_with_lease,
      set_upstream,
      fetch_first,
      rebase_onto,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'start' | 'status' | 'continue' | 'abort' | 'list';
      workflow?: 'snapshot' | 'replay' | 'branch_surgery' | 'publish';
      base_branch?: string;
      log_count: number;
      mode: 'cherry-pick' | 'am';
      target_branch?: string;
      source_commits?: string[];
      patch_files?: string[];
      three_way: boolean;
      backup_branch?: string;
      reset_to?: string;
      confirm_hard_reset: boolean;
      publish: boolean;
      remote?: string;
      force_with_lease: boolean;
      set_upstream: boolean;
      fetch_first: boolean;
      rebase_onto?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const result = await runWorkflowAction(repoPath, {
          action,
          workflow,
          baseBranch: base_branch,
          logCount: log_count,
          mode,
          targetBranch: target_branch,
          sourceCommits: source_commits,
          patchFiles: patch_files,
          threeWay: three_way,
          backupBranch: backup_branch,
          resetTo: reset_to,
          confirmHardReset: confirm_hard_reset,
          publish,
          remote,
          forceWithLease: force_with_lease,
          setUpstream: set_upstream,
          fetchFirst: fetch_first,
          rebaseOnto: rebase_onto,
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
