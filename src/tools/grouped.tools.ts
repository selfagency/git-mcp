import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ALLOW_FORCE_PUSH, ALLOW_NO_VERIFY } from '../config.js';
import { resolveRepoPath } from '../config.js';
import { getGit, toGitError } from '../git/client.js';
import { RepoPathSchema, ResponseFormatSchema } from '../schemas/index.js';
import { runBisectAction, runStashAction, runTagAction } from '../services/advanced.service.js';
import {
  checkoutRef,
  createBranch,
  deleteBranch,
  listBranches,
  renameBranch,
  setUpstream,
} from '../services/branch.service.js';
import { getConfig, getContextSummary, searchHistory, setConfig } from '../services/context.service.js';
import { getDiff, getDiffSummary, getReflog, getStatus, showRef, blameFile } from '../services/inspect.service.js';
import { fetchRemote, listRemotes, manageRemote, pullRemote, pushRemote } from '../services/remote.service.js';
import { addFiles, commitChanges, resetChanges, restoreFiles, revertCommit } from '../services/write.service.js';

function render(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

function buildError(error: unknown): { content: Array<{ type: 'text'; text: string }> } {
  const gitError = toGitError(error);
  return { content: [{ type: 'text', text: `Error (${gitError.kind}): ${gitError.message}` }] };
}

interface ParsedCommit {
  readonly hash: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly dateIso: string;
  readonly subject: string;
}

function parseLogLine(line: string): ParsedCommit | null {
  const [hash, authorName, authorEmail, dateIso, ...subjectParts] = line.split('\t');
  if (!hash || !authorName || !authorEmail || !dateIso) {
    return null;
  }

  return {
    hash,
    authorName,
    authorEmail,
    dateIso,
    subject: subjectParts.join('\t'),
  };
}

export function registerGroupedTools(server: McpServer): void {
  server.registerTool(
    'git_status',
    {
      title: 'Git Status Tools',
      description: 'Status and diff tool. Use action=status|diff|diff_main to inspect working tree and branch deltas.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['status', 'diff', 'diff_main']).default('status'),
        mode: z.enum(['unstaged', 'staged', 'refs']).default('unstaged'),
        from_ref: z.string().optional(),
        to_ref: z.string().optional(),
        filtered: z.boolean().default(false),
        base_branch: z.string().default('main'),
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
      action,
      mode,
      from_ref,
      to_ref,
      filtered,
      base_branch,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'status' | 'diff' | 'diff_main';
      mode: 'unstaged' | 'staged' | 'refs';
      from_ref?: string;
      to_ref?: string;
      filtered: boolean;
      base_branch: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'status') {
          const status = await getStatus(repoPath);
          return {
            content: [{ type: 'text', text: render(status, response_format) }],
            structuredContent: { status },
          };
        }

        if (action === 'diff') {
          const [summary, output] = await Promise.all([
            getDiffSummary(repoPath, { mode, fromRef: from_ref, toRef: to_ref, filtered }),
            getDiff(repoPath, { mode, fromRef: from_ref, toRef: to_ref, filtered }),
          ]);

          const payload = { summary, output };
          return {
            content: [{ type: 'text', text: render(payload, response_format) }],
            structuredContent: payload,
          };
        }

        const git = getGit(repoPath);
        const mergeBase = (await git.raw(['merge-base', 'HEAD', base_branch])).trim();
        const [summary, output] = await Promise.all([
          getDiffSummary(repoPath, { mode: 'refs', fromRef: mergeBase, toRef: 'HEAD', filtered: false }),
          getDiff(repoPath, { mode: 'refs', fromRef: mergeBase, toRef: 'HEAD', filtered: false }),
        ]);

        const payload = {
          base_branch,
          merge_base: mergeBase,
          summary,
          output,
        };

        return {
          content: [{ type: 'text', text: render(payload, response_format) }],
          structuredContent: payload,
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_history',
    {
      title: 'Git History Tools',
      description: 'History tool. Use action=log|show|reflog|blame|lg|who to inspect commits, refs, and contributors.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['log', 'show', 'reflog', 'blame', 'lg', 'who']).default('log'),
        limit: z.number().int().min(1).max(200).default(30),
        offset: z.number().int().min(0).default(0),
        first_parent: z.boolean().default(false),
        no_merges: z.boolean().default(false),
        all_branches: z.boolean().default(false),
        simplify_merges: z.boolean().default(false),
        order: z.enum(['default', 'topo', 'date', 'author-date']).default('default'),
        revision_range: z.string().optional(),
        pathspecs: z.array(z.string()).optional(),
        author: z.string().optional(),
        grep: z.string().optional(),
        since: z.string().optional(),
        until: z.string().optional(),
        file_path: z.string().optional(),
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
      action,
      limit,
      offset,
      first_parent,
      no_merges,
      all_branches,
      simplify_merges,
      order,
      revision_range,
      pathspecs,
      author,
      grep,
      since,
      until,
      file_path,
      ref,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'log' | 'show' | 'reflog' | 'blame' | 'lg' | 'who';
      limit: number;
      offset: number;
      first_parent: boolean;
      no_merges: boolean;
      all_branches: boolean;
      simplify_merges: boolean;
      order: 'default' | 'topo' | 'date' | 'author-date';
      revision_range?: string;
      pathspecs?: string[];
      author?: string;
      grep?: string;
      since?: string;
      until?: string;
      file_path?: string;
      ref?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'log') {
          const git = getGit(repoPath);
          const args = [
            'log',
            '--date=iso-strict',
            `--skip=${offset}`,
            '-n',
            String(limit),
            '--pretty=format:%H%x09%an%x09%ae%x09%aI%x09%s',
          ];

          if (first_parent) {
            args.push('--first-parent');
          }
          if (no_merges) {
            args.push('--no-merges');
          }
          if (all_branches) {
            args.push('--all');
          }
          if (simplify_merges) {
            args.push('--simplify-merges');
          }

          if (order === 'topo') {
            args.push('--topo-order');
          } else if (order === 'date') {
            args.push('--date-order');
          } else if (order === 'author-date') {
            args.push('--author-date-order');
          }

          if (author) {
            args.push(`--author=${author}`);
          }
          if (grep) {
            args.push(`--grep=${grep}`);
          }
          if (since) {
            args.push(`--since=${since}`);
          }
          if (until) {
            args.push(`--until=${until}`);
          }
          if (revision_range) {
            args.push(revision_range);
          }

          const combinedPathspecs = [...(pathspecs ?? []), ...(file_path ? [file_path] : [])];
          if (combinedPathspecs.length > 0) {
            args.push('--', ...combinedPathspecs);
          }

          const rawOutput = await git.raw(args);
          const commits = rawOutput
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(parseLogLine)
            .filter((item): item is ParsedCommit => item !== null);

          return {
            content: [{ type: 'text', text: render(commits, response_format) }],
            structuredContent: { commits },
          };
        }

        if (action === 'show') {
          if (!ref) {
            throw new Error('ref is required for history show.');
          }
          const output = await showRef(repoPath, ref);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { ref, output },
          };
        }

        if (action === 'reflog') {
          const output = await getReflog(repoPath, limit);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'blame') {
          if (!file_path) {
            throw new Error('file_path is required for history blame.');
          }
          const output = await blameFile(repoPath, file_path, ref);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { file_path, ref, output },
          };
        }

        const git = getGit(repoPath);
        if (action === 'lg') {
          const output = await git.raw(['log', '--oneline', '--graph', '--decorate', '--all', '--abbrev-commit']);
          return {
            content: [{ type: 'text', text: render(output.trim() || 'No commits.', response_format) }],
            structuredContent: { output: output.trim() || 'No commits.' },
          };
        }

        const args = ['shortlog', '-s', '-n', '--all', '--no-merges'];
        if (file_path) {
          args.push('--', file_path);
        }
        const output = await git.raw(args);
        return {
          content: [{ type: 'text', text: render(output.trim() || 'No contributors found.', response_format) }],
          structuredContent: {
            file_path: file_path ?? null,
            output: output.trim() || 'No contributors found.',
          },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_commits',
    {
      title: 'Git Commit Tools',
      description: 'Commit-area tool. Use action=add|restore|commit|reset|revert|undo|nuke|wip|unstage|amend.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z
          .enum(['add', 'restore', 'commit', 'reset', 'revert', 'undo', 'nuke', 'wip', 'unstage', 'amend'])
          .default('commit'),
        all: z.boolean().default(false),
        paths: z.array(z.string()).optional(),
        message: z.string().optional(),
        amend: z.boolean().default(false),
        no_edit: z.boolean().default(false),
        sign: z.boolean().default(false),
        signing_key: z.string().optional(),
        no_verify: z.boolean().default(false),
        mode: z.enum(['soft', 'mixed', 'hard']).default('mixed'),
        target: z.string().optional(),
        confirm: z.boolean().default(false),
        staged: z.boolean().default(false),
        worktree: z.boolean().default(true),
        source: z.string().optional(),
        ref: z.string().optional(),
        no_commit: z.boolean().default(false),
        mainline: z.number().int().min(1).optional(),
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
      all,
      paths,
      message,
      amend,
      no_edit,
      sign,
      signing_key,
      no_verify,
      mode,
      target,
      confirm,
      staged,
      worktree,
      source,
      ref,
      no_commit,
      mainline,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'add' | 'restore' | 'commit' | 'reset' | 'revert' | 'undo' | 'nuke' | 'wip' | 'unstage' | 'amend';
      all: boolean;
      paths?: string[];
      message?: string;
      amend: boolean;
      no_edit: boolean;
      sign: boolean;
      signing_key?: string;
      no_verify: boolean;
      mode: 'soft' | 'mixed' | 'hard';
      target?: string;
      confirm: boolean;
      staged: boolean;
      worktree: boolean;
      source?: string;
      ref?: string;
      no_commit: boolean;
      mainline?: number;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'add') {
          const output = await addFiles(repoPath, { all, paths });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'restore') {
          if (!paths || paths.length === 0) {
            throw new Error('paths are required for commit restore.');
          }
          const output = await restoreFiles(repoPath, {
            paths,
            staged,
            worktree,
            source,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'commit') {
          if (!message) {
            throw new Error('message is required for commit action.');
          }
          const output = await commitChanges(repoPath, {
            message,
            all,
            amend,
            noEdit: no_edit,
            sign,
            signingKey: signing_key,
            noVerify: no_verify,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'reset') {
          if (mode === 'hard' && !confirm) {
            throw new Error('Hard reset requires confirm=true.');
          }
          const output = await resetChanges(repoPath, { mode, target, paths });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'revert') {
          if (!ref) {
            throw new Error('ref is required for revert.');
          }
          const output = await revertCommit(repoPath, {
            ref,
            noCommit: no_commit,
            mainline,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'undo') {
          const output = await resetChanges(repoPath, { mode: 'soft', target: 'HEAD~1' });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'nuke') {
          if (!confirm) {
            throw new Error('nuke requires confirm=true because it performs a hard reset.');
          }
          const output = await resetChanges(repoPath, { mode: 'hard', target: 'HEAD~1' });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'wip') {
          await addFiles(repoPath, { all: true });
          const output = await commitChanges(repoPath, {
            message: 'WIP',
            all: false,
            amend: false,
            noEdit: false,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'unstage') {
          if (!paths || paths.length === 0) {
            throw new Error('paths are required for unstage.');
          }
          const output = await restoreFiles(repoPath, {
            paths,
            staged: true,
            worktree: false,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        const output = await commitChanges(repoPath, {
          message: message ?? 'amend',
          all: false,
          amend: true,
          noEdit: true,
          sign,
          signingKey: signing_key,
          noVerify: no_verify,
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

  server.registerTool(
    'git_branches',
    {
      title: 'Git Branch Tools',
      description:
        'Branch tool. Use action=list|create|delete|rename|checkout|set_upstream|recent for branch workflows.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['list', 'create', 'delete', 'rename', 'checkout', 'set_upstream', 'recent']).default('list'),
        all: z.boolean().default(false),
        name: z.string().optional(),
        old_name: z.string().optional(),
        new_name: z.string().optional(),
        from_ref: z.string().optional(),
        ref: z.string().optional(),
        create: z.boolean().default(false),
        force: z.boolean().default(false),
        branch: z.string().optional(),
        upstream: z.string().optional(),
        count: z.number().int().min(1).max(100).default(10),
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
      all,
      name,
      old_name,
      new_name,
      from_ref,
      ref,
      create,
      force,
      branch,
      upstream,
      count,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'list' | 'create' | 'delete' | 'rename' | 'checkout' | 'set_upstream' | 'recent';
      all: boolean;
      name?: string;
      old_name?: string;
      new_name?: string;
      from_ref?: string;
      ref?: string;
      create: boolean;
      force: boolean;
      branch?: string;
      upstream?: string;
      count: number;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'list') {
          const branches = await listBranches(repoPath, all);
          return {
            content: [{ type: 'text', text: render(branches, response_format) }],
            structuredContent: { branches },
          };
        }

        if (action === 'create') {
          if (!name) {
            throw new Error('name is required for branch create.');
          }
          const output = await createBranch(repoPath, { name, fromRef: from_ref, checkout: create });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'delete') {
          if (!name) {
            throw new Error('name is required for branch delete.');
          }
          const output = await deleteBranch(repoPath, { name, force });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'rename') {
          if (!old_name || !new_name) {
            throw new Error('old_name and new_name are required for branch rename.');
          }
          const output = await renameBranch(repoPath, old_name, new_name);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'checkout') {
          if (!ref) {
            throw new Error('ref is required for branch checkout.');
          }
          const output = await checkoutRef(repoPath, ref, create);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'set_upstream') {
          if (!branch || !upstream) {
            throw new Error('branch and upstream are required for set_upstream.');
          }
          const output = await setUpstream(repoPath, branch, upstream);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        const git = getGit(repoPath);
        const output = await git.raw([
          'branch',
          '--sort=-committerdate',
          '--format=%(refname:short) (%(committerdate:relative))',
          '--count',
          String(count),
        ]);
        return {
          content: [{ type: 'text', text: render(output.trim() || 'No branches found.', response_format) }],
          structuredContent: { output: output.trim() || 'No branches found.' },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_remotes',
    {
      title: 'Git Remote Tools',
      description: 'Remote tool. Use action=list|manage|fetch|pull|push for network/transport operations.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['list', 'manage', 'fetch', 'pull', 'push']).default('list'),
        remote_action: z.enum(['add', 'remove', 'set-url']).optional(),
        name: z.string().optional(),
        url: z.string().optional(),
        remote: z.string().optional(),
        branch: z.string().optional(),
        refspecs: z.array(z.string()).optional(),
        prune: z.boolean().default(true),
        prune_tags: z.boolean().default(false),
        negotiation_tips: z.array(z.string()).optional(),
        rebase: z.boolean().default(false),
        rebase_mode: z.enum(['default', 'merges', 'interactive']).default('default'),
        ff_only: z.boolean().default(false),
        set_upstream: z.boolean().default(false),
        force_with_lease: z.boolean().default(false),
        force: z.boolean().default(false),
        no_verify: z.boolean().default(false),
        tags: z.boolean().default(false),
        push_options: z.array(z.string()).optional(),
        atomic: z.boolean().default(false),
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
      remote_action,
      name,
      url,
      remote,
      branch,
      refspecs,
      prune,
      prune_tags,
      negotiation_tips,
      rebase,
      rebase_mode,
      ff_only,
      set_upstream,
      force_with_lease,
      force,
      no_verify,
      tags,
      push_options,
      atomic,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'list' | 'manage' | 'fetch' | 'pull' | 'push';
      remote_action?: 'add' | 'remove' | 'set-url';
      name?: string;
      url?: string;
      remote?: string;
      branch?: string;
      refspecs?: string[];
      prune: boolean;
      prune_tags: boolean;
      negotiation_tips?: string[];
      rebase: boolean;
      rebase_mode: 'default' | 'merges' | 'interactive';
      ff_only: boolean;
      set_upstream: boolean;
      force_with_lease: boolean;
      force: boolean;
      no_verify: boolean;
      tags: boolean;
      push_options?: string[];
      atomic: boolean;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);

        if (action === 'list') {
          const remotes = await listRemotes(repoPath);
          return {
            content: [{ type: 'text', text: render(remotes, response_format) }],
            structuredContent: { remotes },
          };
        }

        if (action === 'manage') {
          if (!remote_action || !name) {
            throw new Error('remote_action and name are required for remotes manage.');
          }
          const output = await manageRemote(repoPath, {
            action: remote_action,
            name,
            url,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'fetch') {
          const shouldUseAdvancedFetch =
            (refspecs?.length ?? 0) > 0 || prune_tags || (negotiation_tips?.length ?? 0) > 0;

          if (shouldUseAdvancedFetch) {
            const args = ['fetch'];
            if (prune) {
              args.push('--prune');
            }
            if (prune_tags) {
              args.push('--prune-tags');
            }
            for (const tip of negotiation_tips ?? []) {
              args.push('--negotiation-tip', tip);
            }
            if (remote) {
              args.push(remote);
            }
            if (refspecs && refspecs.length > 0) {
              args.push(...refspecs);
            } else if (branch) {
              args.push(branch);
            }

            const rawOutput = await git.raw(args);
            const output = rawOutput.trim() || 'Fetch completed.';
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          const output = await fetchRemote(repoPath, {
            remote,
            branch,
            prune,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'pull') {
          const shouldUseAdvancedPull = (refspecs?.length ?? 0) > 0 || ff_only || rebase_mode !== 'default';

          if (shouldUseAdvancedPull) {
            const args = ['pull'];
            if (rebase) {
              if (rebase_mode === 'merges') {
                args.push('--rebase=merges');
              } else if (rebase_mode === 'interactive') {
                args.push('--rebase=interactive');
              } else {
                args.push('--rebase');
              }
            }
            if (ff_only) {
              args.push('--ff-only');
            }
            if (remote) {
              args.push(remote);
            }
            if (refspecs && refspecs.length > 0) {
              args.push(...refspecs);
            } else if (branch) {
              args.push(branch);
            }

            const rawOutput = await git.raw(args);
            const output = rawOutput.trim() || 'Pull completed.';
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          const output = await pullRemote(repoPath, {
            remote,
            branch,
            rebase,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        const shouldUseAdvancedPush = (refspecs?.length ?? 0) > 0 || (push_options?.length ?? 0) > 0 || atomic;

        if (force && !ALLOW_FORCE_PUSH) {
          throw new Error(
            'force push is disabled on this server. Set GIT_ALLOW_FORCE_PUSH=true to enable it. ' +
              'Consider using force_with_lease instead for a safer alternative.',
          );
        }

        if (no_verify && !ALLOW_NO_VERIFY) {
          throw new Error(
            'no_verify is disabled on this server. Set GIT_ALLOW_NO_VERIFY=true to permit bypassing git hooks.',
          );
        }

        if (shouldUseAdvancedPush) {
          const args = ['push'];
          if (set_upstream) {
            args.push('--set-upstream');
          }
          if (force_with_lease) {
            args.push('--force-with-lease');
          }
          if (force) {
            args.push('--force');
          }
          if (tags) {
            args.push('--tags');
          }
          if (no_verify) {
            args.push('--no-verify');
          }
          if (atomic) {
            args.push('--atomic');
          }
          for (const option of push_options ?? []) {
            args.push(`--push-option=${option}`);
          }
          if (remote) {
            args.push(remote);
          }
          if (refspecs && refspecs.length > 0) {
            args.push(...refspecs);
          } else if (branch) {
            args.push(branch);
          }

          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Push completed.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        const output = await pushRemote(repoPath, {
          remote,
          branch,
          setUpstream: set_upstream,
          forceWithLease: force_with_lease,
          force,
          noVerify: no_verify,
          tags,
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

  server.registerTool(
    'git_workspace',
    {
      title: 'Git Workspace Tools',
      description:
        'Workspace tool for stash/rebase/cherry-pick/merge/bisect/tag/worktree/submodule actions plus stash_all shortcut.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z
          .enum(['stash', 'stash_all', 'rebase', 'cherry_pick', 'merge', 'bisect', 'tag', 'worktree', 'submodule'])
          .default('stash'),
        stash_action: z.enum(['save', 'list', 'apply', 'pop', 'drop']).optional(),
        message: z.string().optional(),
        index: z.number().int().min(0).optional(),
        include_untracked: z.boolean().default(false),
        rebase_action: z.enum(['start', 'continue', 'abort', 'skip']).optional(),
        rebase_interactive: z.boolean().default(false),
        rebase_autosquash: z.boolean().default(false),
        rebase_merges: z.boolean().default(false),
        rebase_onto: z.string().optional(),
        rebase_upstream: z.string().optional(),
        rebase_branch: z.string().optional(),
        cherry_pick_action: z.enum(['start', 'continue', 'abort']).optional(),
        cherry_pick_refs: z.array(z.string()).optional(),
        cherry_pick_mainline: z.number().int().min(1).optional(),
        cherry_pick_record_origin: z.boolean().default(false),
        cherry_pick_no_commit: z.boolean().default(false),
        cherry_pick_strategy: z.string().optional(),
        cherry_pick_strategy_options: z.array(z.string()).optional(),
        merge_action: z.enum(['start', 'continue', 'abort']).optional(),
        merge_refs: z.array(z.string()).optional(),
        merge_no_ff: z.boolean().default(false),
        merge_ff_only: z.boolean().default(false),
        merge_squash: z.boolean().default(false),
        merge_no_commit: z.boolean().default(false),
        merge_log: z.boolean().default(false),
        merge_strategy: z.string().optional(),
        merge_strategy_options: z.array(z.string()).optional(),
        conflict_style: z.enum(['merge', 'diff3', 'zdiff3']).optional(),
        bisect_action: z.enum(['start', 'good', 'bad', 'skip', 'run', 'reset']).optional(),
        tag_action: z.enum(['list', 'create', 'delete']).optional(),
        worktree_action: z.enum(['add', 'list', 'remove', 'lock', 'unlock', 'prune', 'repair']).optional(),
        submodule_action: z.enum(['add', 'list', 'update', 'sync', 'foreach', 'set_branch']).optional(),
        ref: z.string().optional(),
        onto: z.string().optional(),
        good_ref: z.string().optional(),
        bad_ref: z.string().optional(),
        command: z.string().optional(),
        name: z.string().optional(),
        target: z.string().optional(),
        sign: z.boolean().default(false),
        signing_key: z.string().optional(),
        path: z.string().optional(),
        paths: z.array(z.string()).optional(),
        branch: z.string().optional(),
        url: z.string().optional(),
        recursive: z.boolean().default(true),
        worktree_force: z.boolean().default(false),
        worktree_detached: z.boolean().default(false),
        worktree_lock_reason: z.string().optional(),
        worktree_expire: z.string().optional(),
        submodule_remote: z.boolean().default(false),
        submodule_depth: z.number().int().min(1).optional(),
        submodule_jobs: z.number().int().min(1).optional(),
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
      stash_action,
      message,
      index,
      include_untracked,
      rebase_action,
      rebase_interactive,
      rebase_autosquash,
      rebase_merges,
      rebase_onto,
      rebase_upstream,
      rebase_branch,
      cherry_pick_action,
      cherry_pick_refs,
      cherry_pick_mainline,
      cherry_pick_record_origin,
      cherry_pick_no_commit,
      cherry_pick_strategy,
      cherry_pick_strategy_options,
      merge_action,
      merge_refs,
      merge_no_ff,
      merge_ff_only,
      merge_squash,
      merge_no_commit,
      merge_log,
      merge_strategy,
      merge_strategy_options,
      conflict_style,
      bisect_action,
      tag_action,
      worktree_action,
      submodule_action,
      ref,
      onto,
      good_ref,
      bad_ref,
      command,
      name,
      target,
      sign,
      signing_key,
      path,
      paths,
      branch,
      url,
      recursive,
      worktree_force,
      worktree_detached,
      worktree_lock_reason,
      worktree_expire,
      submodule_remote,
      submodule_depth,
      submodule_jobs,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'stash' | 'stash_all' | 'rebase' | 'cherry_pick' | 'merge' | 'bisect' | 'tag' | 'worktree' | 'submodule';
      stash_action?: 'save' | 'list' | 'apply' | 'pop' | 'drop';
      message?: string;
      index?: number;
      include_untracked: boolean;
      rebase_action?: 'start' | 'continue' | 'abort' | 'skip';
      rebase_interactive: boolean;
      rebase_autosquash: boolean;
      rebase_merges: boolean;
      rebase_onto?: string;
      rebase_upstream?: string;
      rebase_branch?: string;
      cherry_pick_action?: 'start' | 'continue' | 'abort';
      cherry_pick_refs?: string[];
      cherry_pick_mainline?: number;
      cherry_pick_record_origin: boolean;
      cherry_pick_no_commit: boolean;
      cherry_pick_strategy?: string;
      cherry_pick_strategy_options?: string[];
      merge_action?: 'start' | 'continue' | 'abort';
      merge_refs?: string[];
      merge_no_ff: boolean;
      merge_ff_only: boolean;
      merge_squash: boolean;
      merge_no_commit: boolean;
      merge_log: boolean;
      merge_strategy?: string;
      merge_strategy_options?: string[];
      conflict_style?: 'merge' | 'diff3' | 'zdiff3';
      bisect_action?: 'start' | 'good' | 'bad' | 'skip' | 'run' | 'reset';
      tag_action?: 'list' | 'create' | 'delete';
      worktree_action?: 'add' | 'list' | 'remove' | 'lock' | 'unlock' | 'prune' | 'repair';
      submodule_action?: 'add' | 'list' | 'update' | 'sync' | 'foreach' | 'set_branch';
      ref?: string;
      onto?: string;
      good_ref?: string;
      bad_ref?: string;
      command?: string;
      name?: string;
      target?: string;
      sign: boolean;
      signing_key?: string;
      path?: string;
      paths?: string[];
      branch?: string;
      url?: string;
      recursive: boolean;
      worktree_force: boolean;
      worktree_detached: boolean;
      worktree_lock_reason?: string;
      worktree_expire?: string;
      submodule_remote: boolean;
      submodule_depth?: number;
      submodule_jobs?: number;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);
        const git = getGit(repoPath);

        if (action === 'stash') {
          const output = await runStashAction(repoPath, {
            action: stash_action ?? 'list',
            message,
            index,
            includeUntracked: include_untracked,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'stash_all') {
          const output = await runStashAction(repoPath, {
            action: 'save',
            includeUntracked: true,
            message,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'rebase') {
          const op = rebase_action ?? 'start';
          const args = ['rebase'];

          if (op === 'continue') {
            args.push('--continue');
          } else if (op === 'abort') {
            args.push('--abort');
          } else if (op === 'skip') {
            args.push('--skip');
          } else {
            if (rebase_interactive) {
              args.push('-i');
            }
            if (rebase_autosquash) {
              args.push('--autosquash');
            }
            if (rebase_merges) {
              args.push('--rebase-merges');
            }

            const resolvedOnto = rebase_onto ?? onto;
            if (resolvedOnto) {
              args.push('--onto', resolvedOnto);
            }

            const upstreamRef = rebase_upstream ?? onto;
            if (!upstreamRef) {
              throw new Error('rebase_upstream (or onto) is required for rebase start.');
            }
            args.push(upstreamRef);

            if (rebase_branch) {
              args.push(rebase_branch);
            }
          }

          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Rebase completed.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'cherry_pick') {
          const op = cherry_pick_action ?? 'start';
          const args = ['cherry-pick'];

          if (op === 'continue') {
            args.push('--continue');
          } else if (op === 'abort') {
            args.push('--abort');
          } else {
            if (cherry_pick_mainline !== undefined) {
              args.push('--mainline', String(cherry_pick_mainline));
            }
            if (cherry_pick_record_origin) {
              args.push('-x');
            }
            if (cherry_pick_no_commit) {
              args.push('--no-commit');
            }
            if (cherry_pick_strategy) {
              args.push('--strategy', cherry_pick_strategy);
            }
            for (const strategyOption of cherry_pick_strategy_options ?? []) {
              args.push('--strategy-option', strategyOption);
            }

            const refs = cherry_pick_refs ?? (ref ? [ref] : []);
            if (refs.length === 0) {
              throw new Error('ref or cherry_pick_refs is required for cherry_pick start.');
            }
            args.push(...refs);
          }

          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Cherry-pick completed.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'merge') {
          const op = merge_action ?? 'start';
          const args = ['merge'];

          if (op === 'continue') {
            args.push('--continue');
          } else if (op === 'abort') {
            args.push('--abort');
          } else {
            if (merge_no_ff) {
              args.push('--no-ff');
            }
            if (merge_ff_only) {
              args.push('--ff-only');
            }
            if (merge_squash) {
              args.push('--squash');
            }
            if (merge_no_commit) {
              args.push('--no-commit');
            }
            if (merge_log) {
              args.push('--log');
            }
            if (merge_strategy) {
              args.push('--strategy', merge_strategy);
            }
            if (conflict_style) {
              args.push(`--conflict=${conflict_style}`);
            }
            for (const strategyOption of merge_strategy_options ?? []) {
              args.push('--strategy-option', strategyOption);
            }

            const refs = merge_refs ?? (ref ? [ref] : []);
            if (refs.length === 0) {
              throw new Error('ref or merge_refs is required for merge start.');
            }
            args.push(...refs);
          }

          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Merge completed.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'bisect') {
          const output = await runBisectAction(repoPath, {
            action: bisect_action ?? 'start',
            ref,
            goodRef: good_ref,
            badRef: bad_ref,
            command,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'tag') {
          const output = await runTagAction(repoPath, {
            action: tag_action ?? 'list',
            name,
            target,
            message,
            sign,
            signingKey: signing_key,
          });
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'worktree') {
          const op = worktree_action ?? 'list';

          if (op === 'list') {
            const rawOutput = await git.raw(['worktree', 'list', '--porcelain']);
            const output = rawOutput.trim() || 'No worktrees.';
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          if (op === 'remove') {
            if (!path) {
              throw new Error('path is required for worktree remove.');
            }
            const args = ['worktree', 'remove'];
            if (worktree_force) {
              args.push('--force');
            }
            args.push(path);
            const rawOutput = await git.raw(args);
            const output = rawOutput.trim() || `Removed worktree ${path}.`;
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          if (op === 'lock' || op === 'unlock') {
            if (!path) {
              throw new Error('path is required for worktree lock/unlock.');
            }
            const args = ['worktree', op, path];
            if (op === 'lock' && worktree_lock_reason) {
              args.push('--reason', worktree_lock_reason);
            }
            const rawOutput = await git.raw(args);
            const output = rawOutput.trim() || `Worktree ${op} completed for ${path}.`;
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          if (op === 'prune') {
            const args = ['worktree', 'prune'];
            if (worktree_expire) {
              args.push(`--expire=${worktree_expire}`);
            }
            const rawOutput = await git.raw(args);
            const output = rawOutput.trim() || 'Worktree prune completed.';
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          if (op === 'repair') {
            const args = ['worktree', 'repair'];
            if (paths && paths.length > 0) {
              args.push(...paths);
            }
            const rawOutput = await git.raw(args);
            const output = rawOutput.trim() || 'Worktree repair completed.';
            return {
              content: [{ type: 'text', text: render(output, response_format) }],
              structuredContent: { output },
            };
          }

          if (!path) {
            throw new Error('path is required for worktree add.');
          }

          const args = ['worktree', 'add'];
          if (worktree_force) {
            args.push('--force');
          }
          if (worktree_detached) {
            args.push('--detach');
          }
          if (worktree_lock_reason) {
            args.push('--lock', '--reason', worktree_lock_reason);
          }
          args.push(path);
          if (branch) {
            args.push(branch);
          } else if (!worktree_detached) {
            throw new Error('branch is required for worktree add unless worktree_detached=true.');
          }

          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || `Added worktree at ${path}.`;
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        const submoduleOp = submodule_action ?? 'list';

        if (submoduleOp === 'list') {
          const rawOutput = await git.raw(['submodule', 'status']);
          const output = rawOutput.trim() || 'No submodules.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (submoduleOp === 'sync') {
          const args = ['submodule', 'sync'];
          if (recursive) {
            args.push('--recursive');
          }
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Submodule sync complete.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (submoduleOp === 'update') {
          const args = ['submodule', 'update', '--init'];
          if (recursive) {
            args.push('--recursive');
          }
          if (submodule_remote) {
            args.push('--remote');
          }
          if (submodule_depth !== undefined) {
            args.push('--depth', String(submodule_depth));
          }
          if (submodule_jobs !== undefined) {
            args.push('--jobs', String(submodule_jobs));
          }
          if (paths && paths.length > 0) {
            args.push('--', ...paths);
          }
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Submodule update complete.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (submoduleOp === 'foreach') {
          if (!command) {
            throw new Error('command is required for submodule foreach.');
          }
          const args = ['submodule', 'foreach'];
          if (recursive) {
            args.push('--recursive');
          }
          args.push(command);
          const rawOutput = await git.raw(args);
          const output = rawOutput.trim() || 'Submodule foreach completed.';
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (submoduleOp === 'set_branch') {
          if (!branch || !path) {
            throw new Error('branch and path are required for submodule set_branch.');
          }
          const rawOutput = await git.raw(['submodule', 'set-branch', '--branch', branch, '--', path]);
          const output = rawOutput.trim() || `Set submodule ${path} branch to ${branch}.`;
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (!url || !path) {
          throw new Error('url and path are required for submodule add.');
        }

        const rawOutput = await git.raw(['submodule', 'add', url, path]);
        const output = rawOutput.trim() || `Added submodule ${path}.`;

        return {
          content: [{ type: 'text', text: render(output, response_format) }],
          structuredContent: { output },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );

  server.registerTool(
    'git_context',
    {
      title: 'Git Context Tools',
      description:
        'Context/config tool. Use action=summary|search|get_config|set_config|aliases for repo context operations.',
      inputSchema: {
        repo_path: RepoPathSchema,
        action: z.enum(['summary', 'search', 'get_config', 'set_config', 'aliases']).default('summary'),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(20),
        key: z.string().optional(),
        value: z.string().optional(),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({
      repo_path,
      action,
      query,
      limit,
      key,
      value,
      response_format,
    }: {
      repo_path: string | undefined;
      action: 'summary' | 'search' | 'get_config' | 'set_config' | 'aliases';
      query?: string;
      limit: number;
      key?: string;
      value?: string;
      response_format: 'markdown' | 'json';
    }) => {
      try {
        const repoPath = resolveRepoPath(repo_path);

        if (action === 'summary') {
          const summary = await getContextSummary(repoPath);
          return {
            content: [{ type: 'text', text: render(summary, response_format) }],
            structuredContent: { summary },
          };
        }

        if (action === 'search') {
          if (!query) {
            throw new Error('query is required for context search.');
          }
          const output = await searchHistory(repoPath, query, limit);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'get_config') {
          const output = await getConfig(repoPath, key);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        if (action === 'set_config') {
          if (!key || value === undefined) {
            throw new Error('key and value are required for context set_config.');
          }
          const output = await setConfig(repoPath, key, value);
          return {
            content: [{ type: 'text', text: render(output, response_format) }],
            structuredContent: { output },
          };
        }

        const git = getGit(repoPath);
        const output = await git.raw(['config', '--get-regexp', '^alias\\.']).catch(() => '');
        return {
          content: [{ type: 'text', text: render(output.trim() || 'No aliases configured.', response_format) }],
          structuredContent: { output: output.trim() || 'No aliases configured.' },
        };
      } catch (error) {
        return buildError(error);
      }
    },
  );
}
