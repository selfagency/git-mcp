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
