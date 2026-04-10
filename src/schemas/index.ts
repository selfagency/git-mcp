import { z } from 'zod';

export const RepoPathSchema = z
  .string()
  .min(1)
  .optional()
  .describe(
    'Absolute path to the local Git repository. ' +
      'If omitted, falls back to the server default set via the GIT_REPO_PATH environment variable or --repo-path CLI argument.',
  );

export const RefSchema = z
  .string()
  .min(1, 'ref is required')
  .describe('Git reference: branch, tag, commit SHA, or HEAD expression.');

export const PaginationSchema = z
  .object({
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export const ConfirmSchema = z.boolean().default(false);

export const ResponseFormatSchema = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe('Output format for the response.');

export const FlowPresetSchema = z
  .enum(['classic', 'github', 'gitlab'])
  .default('classic')
  .describe('git-flow-next preset to initialize.');

export const FlowConfigScopeSchema = z
  .enum(['local', 'global', 'system', 'file'])
  .default('local')
  .describe('Git config scope used for init writes.');

export const FlowBranchKindSchema = z
  .enum(['base', 'topic'])
  .describe('Whether a flow config operation targets a base branch or topic branch type.');

export const FlowMergeStrategySchema = z
  .enum(['merge', 'rebase', 'squash', 'none'])
  .describe('Merge strategy for flow branch integration.');

export const FlowConfigActionSchema = z
  .enum(['list', 'add', 'update', 'rename', 'delete'])
  .describe('Flow configuration operation.');

export const FlowTopicActionSchema = z
  .enum(['start', 'finish', 'publish', 'list', 'update', 'delete', 'rename', 'checkout', 'track'])
  .describe('Topic branch lifecycle operation.');

export const FlowControlActionSchema = z
  .enum(['continue', 'abort'])
  .describe('Continue or abort an in-progress flow finish operation.');

export const FlowMatchModeSchema = z
  .enum(['exact', 'prefix'])
  .default('exact')
  .describe('How topic names should be resolved for checkout and shorthand operations.');
