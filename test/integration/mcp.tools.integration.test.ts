/**
 * Integration tests for MCP tool handlers.
 *
 * These tests verify that the registered MCP tools:
 *   1. Are correctly registered and callable.
 *   2. Return expected content shapes.
 *   3. Surface Git errors properly.
 *
 * The git/client module is mocked so no real git binary is invoked.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock simple-git and git client
// ---------------------------------------------------------------------------
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock getGit so all service calls go through a controlled mock.
// Must use vi.hoisted() so the value is available inside the vi.mock() factory,
// which is hoisted to the top of the file before any const declarations run.
const mockGit = vi.hoisted(() => ({
  status: vi.fn(),
  raw: vi.fn(),
  log: vi.fn(),
  branch: vi.fn(),
  checkout: vi.fn(),
  checkoutBranch: vi.fn(),
  checkoutLocalBranch: vi.fn(),
  deleteLocalBranch: vi.fn(),
  getRemotes: vi.fn(),
  addRemote: vi.fn(),
  removeRemote: vi.fn(),
  remote: vi.fn(),
  fetch: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  commit: vi.fn(),
  add: vi.fn(),
  tags: vi.fn(),
  tag: vi.fn(),
  addTag: vi.fn(),
  addAnnotatedTag: vi.fn(),
  diffSummary: vi.fn(),
}));

vi.mock('../../src/git/client.js', () => ({
  getGit: vi.fn().mockReturnValue(mockGit),
  validateRepoPath: vi.fn((p: string) => p),
  validatePathArgument: vi.fn((_: string, filePath: string) => filePath),
  validatePathArguments: vi.fn((_: string, paths: string[]) => paths),
  toGitError: (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: 'unknown', message: msg };
  },
}));

import { registerFlowTools } from '../../src/tools/flow.tools.js';
import { registerGroupedTools } from '../../src/tools/grouped.tools.js';
import { registerWorkflowTools } from '../../src/tools/workflow.tools.js';

// ---------------------------------------------------------------------------
// Helper to create a test MCP server and invoke a tool
// ---------------------------------------------------------------------------
function createTestServer() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerGroupedTools(server);
  registerFlowTools(server);
  registerWorkflowTools(server);
  return server;
}

// Access the internal tool registry.
// In @modelcontextprotocol/sdk the registry is a plain object keyed by tool name,
// and each entry exposes a `handler` function.
async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[name];
  if (!tool) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return await tool.handler(args, {} as any);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  server = createTestServer();
});

// ---------------------------------------------------------------------------
// git_status
// ---------------------------------------------------------------------------
describe('git_status tool', () => {
  it('returns status content', async () => {
    mockGit.status.mockResolvedValue({
      current: 'main',
      tracking: 'origin/main',
      ahead: 0,
      behind: 0,
      files: [],
      isClean: () => true,
    });

    const result = await callTool(server, 'git_status', {
      repo_path: '/repo',
      action: 'status',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('status');
    expect(result.structuredContent.status.branch).toBe('main');
  });

  it('returns error content when git throws', async () => {
    mockGit.status.mockRejectedValue(new Error('not a git repository'));

    const result = await callTool(server, 'git_status', { repo_path: '/repo', response_format: 'markdown' });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

// ---------------------------------------------------------------------------
// git_history (log)
// ---------------------------------------------------------------------------
describe('git_history tool', () => {
  it('returns commit log', async () => {
    const logLine = 'abc1234\tJohn\tjohn@example.com\t2024-01-01T00:00:00Z\tfeat: init';
    mockGit.raw.mockResolvedValue(logLine);

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      limit: 10,
      offset: 0,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('commits');
  });
});

// ---------------------------------------------------------------------------
// git_status (diff)
// ---------------------------------------------------------------------------
describe('git_status diff action', () => {
  it('returns diff content', async () => {
    mockGit.diffSummary.mockResolvedValue({ files: [{}, {}], insertions: 5, deletions: 2 });
    mockGit.raw.mockResolvedValue('diff --git a/src/foo.ts b/src/foo.ts\n+added line');

    const result = await callTool(server, 'git_status', {
      repo_path: '/repo',
      action: 'diff',
      mode: 'unstaged',
      filtered: false,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('summary');
  });
});

// ---------------------------------------------------------------------------
// git_commits (add)
// ---------------------------------------------------------------------------
describe('git_commits tool', () => {
  it('stages all files', async () => {
    mockGit.add.mockResolvedValue('');
    const result = await callTool(server, 'git_commits', { repo_path: '/repo', action: 'add', all: true });
    expect(result.structuredContent.output).toBe('Staged all changes.');
  });

  it('stages specific paths', async () => {
    mockGit.add.mockResolvedValue('');
    const result = await callTool(server, 'git_commits', { repo_path: '/repo', action: 'add', paths: ['a.ts'] });
    expect(result.structuredContent.output).toBe('Staged 1 path(s).');
  });
});

// ---------------------------------------------------------------------------
// git_commits (commit)
// ---------------------------------------------------------------------------
describe('git_commits commit action', () => {
  it('commits with message', async () => {
    mockGit.commit.mockResolvedValue({ commit: 'abc1234' });
    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'commit',
      message: 'feat: test',
      all: false,
      amend: false,
      no_edit: false,
    });
    expect(result.content[0].text).toContain('abc1234');
  });
});

// ---------------------------------------------------------------------------
// git_branches (list)
// ---------------------------------------------------------------------------
describe('git_branches tool', () => {
  it('lists branches', async () => {
    mockGit.branch.mockResolvedValue({ all: ['main', 'dev'], current: 'main', branches: {} });
    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'list',
      all: false,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('branches');
  });
});

// ---------------------------------------------------------------------------
// git_remotes
// ---------------------------------------------------------------------------
describe('git_remotes tool', () => {
  it('lists remotes', async () => {
    mockGit.getRemotes.mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/a/b.git', push: 'https://github.com/a/b.git' } },
    ]);
    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'list',
    });
    expect(result.content[0].type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// git_workspace (tag)
// ---------------------------------------------------------------------------
describe('git_workspace tag actions', () => {
  it('lists tags', async () => {
    mockGit.tags.mockResolvedValue({ all: ['v1.0', 'v2.0'] });
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'tag',
      tag_action: 'list',
    });
    expect(result.content[0].text).toContain('v1.0');
  });

  it('creates a lightweight tag', async () => {
    mockGit.addTag.mockResolvedValue('');
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'tag',
      tag_action: 'create',
      name: 'v3.0',
    });
    expect(result.content[0].text).toContain('v3.0');
  });
});

// ---------------------------------------------------------------------------
// git_context (summary)
// ---------------------------------------------------------------------------
describe('git_context tool', () => {
  it('returns a context summary', async () => {
    mockGit.status.mockResolvedValue({
      current: 'main',
      tracking: 'origin/main',
      ahead: 1,
      behind: 0,
      files: [],
      isClean: () => true,
    });
    mockGit.raw.mockResolvedValue('');
    mockGit.getRemotes.mockResolvedValue([{ name: 'origin' }]);

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'summary',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result).toHaveProperty('structuredContent');
  });
});

// ---------------------------------------------------------------------------
// git_flow
// ---------------------------------------------------------------------------
describe('git_flow tool', () => {
  it('returns overview data', async () => {
    mockGit.raw.mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--get-regexp') {
        return [
          'gitflow.version 1.0',
          'gitflow.initialized true',
          'gitflow.branch.main.type base',
          'gitflow.branch.feature.type topic',
          'gitflow.branch.feature.parent main',
          'gitflow.branch.feature.prefix feature/',
        ].join('\n');
      }

      if (args[0] === 'for-each-ref') {
        return 'feature/test\torigin/feature/test\t=';
      }

      return '';
    });
    mockGit.status.mockResolvedValue({
      current: 'feature/test',
      tracking: 'origin/feature/test',
      ahead: 0,
      behind: 0,
      files: [],
      isClean: () => true,
    });

    const result = await callTool(server, 'git_flow', {
      repo_path: '/repo',
      action: 'overview',
      response_format: 'json',
      tag: true,
      delete_branch: true,
      force: false,
      no_create_branches: false,
    });

    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toMatchObject({
      initialized: true,
      compatibility: 'structured',
    });
  });

  it('accepts the canonical operation contract', async () => {
    mockGit.raw.mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--get-regexp') {
        return '';
      }

      return '';
    });

    const result = await callTool(server, 'git_flow', {
      repo_path: '/repo',
      operation: 'config',
      config_action: 'add',
      name: 'qa',
      branch_kind: 'base',
      parent: 'main',
      response_format: 'json',
      tag: true,
      delete_branch: true,
      force: false,
      no_create_branches: false,
      no_backmerge: false,
    });

    expect(result.structuredContent).toMatchObject({
      action: 'add',
      branch: { name: 'qa', kind: 'base' },
    });
  });
});

// ---------------------------------------------------------------------------
// git_workflow
// ---------------------------------------------------------------------------
describe('git_workflow tool', () => {
  it('lists supported workflows', async () => {
    const result = await callTool(server, 'git_workflow', {
      repo_path: '/repo',
      action: 'list',
      response_format: 'json',
      log_count: 12,
      mode: 'cherry-pick',
      three_way: true,
      confirm_hard_reset: false,
      publish: false,
      force_with_lease: false,
      set_upstream: false,
      fetch_first: true,
    });

    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent.workflows).toContain('snapshot');
  });

  it('runs snapshot workflow', async () => {
    mockGit.raw.mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--local' && args[2] === '--get') {
        throw new Error('not found');
      }

      if (args[0] === 'remote') return 'origin\thttps://example.com/repo.git (fetch)';
      if (args[0] === 'branch') return '* main 1234567 [origin/main]';
      if (args[0] === 'merge-base') return '1234567';
      if (args[0] === 'log') return '* 1234567 init';
      if (args[0] === 'status') return ' M src/index.ts';
      return '';
    });

    const result = await callTool(server, 'git_workflow', {
      repo_path: '/repo',
      action: 'start',
      workflow: 'snapshot',
      base_branch: 'origin/main',
      log_count: 5,
      mode: 'cherry-pick',
      three_way: true,
      confirm_hard_reset: false,
      publish: false,
      force_with_lease: false,
      set_upstream: false,
      fetch_first: true,
      response_format: 'json',
    });

    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent.workflow).toBe('snapshot');
  });
});

// ---------------------------------------------------------------------------
// git_history — additional actions and advanced query params
// ---------------------------------------------------------------------------
describe('git_history show action', () => {
  it('shows a ref', async () => {
    mockGit.raw.mockResolvedValue('commit abc1234\nAuthor: Jane\n\nfeat: something');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'show',
      ref: 'abc1234',
      response_format: 'json',
    });
    expect(result.structuredContent).toMatchObject({ ref: 'abc1234' });
    expect(result.structuredContent.output).toContain('feat: something');
  });

  it('returns error when ref is missing', async () => {
    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'show',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_history reflog action', () => {
  it('returns reflog entries', async () => {
    mockGit.raw.mockResolvedValue('abc1234 HEAD@{0}: commit: init');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'reflog',
      limit: 10,
      response_format: 'json',
    });
    expect(result.structuredContent).toHaveProperty('output');
  });
});

describe('git_history blame action', () => {
  it('blames a file', async () => {
    mockGit.raw.mockResolvedValue('abc1234 (Jane 2024-01-01 1) const x = 1;');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'blame',
      file_path: 'src/index.ts',
      response_format: 'json',
    });
    expect(result.structuredContent.file_path).toBe('src/index.ts');
    expect(result.structuredContent.output).toContain('Jane');
  });

  it('returns error when file_path is missing', async () => {
    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'blame',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_history lg action', () => {
  it('returns graph log', async () => {
    mockGit.raw.mockResolvedValue('* abc1234 (HEAD) feat: init');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'lg',
      response_format: 'markdown',
    });
    expect(result.structuredContent.output).toContain('feat: init');
  });

  it('returns placeholder when log is empty', async () => {
    mockGit.raw.mockResolvedValue('   ');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'lg',
      response_format: 'markdown',
    });
    expect(result.structuredContent.output).toBe('No commits.');
  });
});

describe('git_history who action', () => {
  it('returns contributor shortlog', async () => {
    mockGit.raw.mockResolvedValue('  42\tJane Doe');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'who',
      response_format: 'json',
    });
    expect(result.structuredContent.output).toContain('Jane Doe');
  });

  it('filters by file path', async () => {
    mockGit.raw.mockResolvedValue('   5\tJohn Smith');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'who',
      file_path: 'src/index.ts',
      response_format: 'json',
    });
    expect(result.structuredContent.file_path).toBe('src/index.ts');
  });
});

describe('git_history log advanced params', () => {
  it('applies first_parent flag', async () => {
    mockGit.raw.mockResolvedValue('abc1234\tJane\tjane@x.com\t2024-01-01T00:00:00Z\tfeat: init');

    const result = await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      first_parent: true,
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--first-parent');
    expect(result.structuredContent.commits).toHaveLength(1);
  });

  it('applies no_merges and topo order flags', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      no_merges: true,
      order: 'topo',
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--no-merges');
    expect(rawArgs).toContain('--topo-order');
  });

  it('applies all_branches and date order flags', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      all_branches: true,
      order: 'date',
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--all');
    expect(rawArgs).toContain('--date-order');
  });

  it('applies simplify_merges and author-date order', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      simplify_merges: true,
      order: 'author-date',
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--simplify-merges');
    expect(rawArgs).toContain('--author-date-order');
  });

  it('applies revision_range', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      revision_range: 'v1.0...v2.0',
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('v1.0...v2.0');
  });

  it('applies pathspecs with separator', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      pathspecs: ['src/', 'lib/'],
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--');
    expect(rawArgs).toContain('src/');
    expect(rawArgs).toContain('lib/');
  });

  it('applies author and grep filters', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_history', {
      repo_path: '/repo',
      action: 'log',
      author: 'jane',
      grep: 'feat:',
      since: '2024-01-01',
      until: '2024-12-31',
      response_format: 'json',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--author=jane');
    expect(rawArgs).toContain('--grep=feat:');
    expect(rawArgs).toContain('--since=2024-01-01');
    expect(rawArgs).toContain('--until=2024-12-31');
  });
});

// ---------------------------------------------------------------------------
// git_commits — remaining actions
// ---------------------------------------------------------------------------
describe('git_commits restore action', () => {
  it('restores specified paths', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'restore',
      paths: ['src/foo.ts'],
      staged: false,
      worktree: true,
    });
    expect(result.structuredContent.output).toBeTruthy();
  });

  it('returns error when paths missing', async () => {
    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'restore',
      paths: [],
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_commits reset action', () => {
  it('performs a mixed reset', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'reset',
      mode: 'mixed',
      target: 'HEAD~1',
      confirm: false,
    });
    expect(result.content[0].type).toBe('text');
  });

  it('requires confirm for hard reset', async () => {
    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'reset',
      mode: 'hard',
      confirm: false,
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('allows hard reset when confirm=true', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'reset',
      mode: 'hard',
      confirm: true,
    });
    expect(result.content[0].type).toBe('text');
  });
});

describe('git_commits revert action', () => {
  it('reverts a commit by ref', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'revert',
      ref: 'abc1234',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when ref missing', async () => {
    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'revert',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_commits undo action', () => {
  it('soft-resets HEAD~1', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'undo',
    });
    expect(result.content[0].type).toBe('text');
  });
});

describe('git_commits nuke action', () => {
  it('requires confirm=true', async () => {
    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'nuke',
      confirm: false,
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('hard-resets HEAD~1 when confirmed', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'nuke',
      confirm: true,
    });
    expect(result.content[0].type).toBe('text');
  });
});

describe('git_commits wip action', () => {
  it('stages all and commits WIP', async () => {
    mockGit.add.mockResolvedValue('');
    mockGit.commit.mockResolvedValue({ commit: 'wip123' });

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'wip',
    });
    expect(result.content[0].type).toBe('text');
  });
});

describe('git_commits unstage action', () => {
  it('unstages specified paths', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'unstage',
      paths: ['src/foo.ts'],
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when paths missing', async () => {
    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'unstage',
      paths: [],
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_commits amend action', () => {
  it('amends the last commit', async () => {
    mockGit.commit.mockResolvedValue({ commit: 'abc9999' });

    const result = await callTool(server, 'git_commits', {
      repo_path: '/repo',
      action: 'amend',
    });
    expect(result.content[0].type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// git_branches — remaining actions
// ---------------------------------------------------------------------------
describe('git_branches create action', () => {
  it('creates a branch', async () => {
    mockGit.checkoutLocalBranch.mockResolvedValue('');

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'create',
      name: 'feature/test',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when name missing', async () => {
    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'create',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_branches delete action', () => {
  it('deletes a branch', async () => {
    mockGit.deleteLocalBranch.mockResolvedValue({ branch: 'feature/test' });

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'delete',
      name: 'feature/test',
      force: false,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when name missing', async () => {
    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'delete',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_branches rename action', () => {
  it('renames a branch', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'rename',
      old_name: 'feature/old',
      new_name: 'feature/new',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when names missing', async () => {
    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'rename',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_branches checkout action', () => {
  it('checks out a ref', async () => {
    mockGit.checkout.mockResolvedValue('');

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'checkout',
      ref: 'main',
      create: false,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when ref missing', async () => {
    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'checkout',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_branches set_upstream action', () => {
  it('sets tracking upstream', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'set_upstream',
      branch: 'feature/test',
      upstream: 'origin/feature/test',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when branch or upstream missing', async () => {
    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'set_upstream',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_branches recent action', () => {
  it('returns recently active branches', async () => {
    mockGit.raw.mockResolvedValue('feature/test (2 days ago)\nmain (1 week ago)');

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'recent',
      count: 5,
      response_format: 'markdown',
    });
    expect(result.structuredContent.output).toContain('feature/test');
  });

  it('returns placeholder when no branches found', async () => {
    mockGit.raw.mockResolvedValue('   ');

    const result = await callTool(server, 'git_branches', {
      repo_path: '/repo',
      action: 'recent',
      response_format: 'markdown',
    });
    expect(result.structuredContent.output).toBe('No branches found.');
  });
});

// ---------------------------------------------------------------------------
// git_remotes — fetch, pull, push (basic and advanced)
// ---------------------------------------------------------------------------
describe('git_remotes manage action', () => {
  it('adds a remote', async () => {
    mockGit.addRemote.mockResolvedValue('');

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'manage',
      remote_action: 'add',
      name: 'upstream',
      url: 'https://github.com/foo/bar.git',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('removes a remote', async () => {
    mockGit.removeRemote.mockResolvedValue('');

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'manage',
      remote_action: 'remove',
      name: 'upstream',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when remote_action or name missing', async () => {
    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'manage',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_remotes fetch action', () => {
  it('performs basic fetch', async () => {
    mockGit.fetch.mockResolvedValue('');

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'fetch',
      remote: 'origin',
      prune: true,
    });
    expect(result.content[0].type).toBe('text');
  });

  it('uses raw git for advanced fetch with refspecs', async () => {
    mockGit.raw.mockResolvedValue('Fetch completed.');

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'fetch',
      remote: 'origin',
      refspecs: ['refs/heads/main:refs/remotes/origin/main'],
      prune: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('fetch');
    expect(rawArgs).toContain('refs/heads/main:refs/remotes/origin/main');
    expect(result.structuredContent.output).toBeTruthy();
  });

  it('uses raw git for fetch with prune_tags', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'fetch',
      prune_tags: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--prune-tags');
  });

  it('uses raw git for fetch with negotiation_tips', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'fetch',
      negotiation_tips: ['abc1234', 'def5678'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--negotiation-tip');
    expect(rawArgs).toContain('abc1234');
  });
});

describe('git_remotes pull action', () => {
  it('performs basic pull', async () => {
    mockGit.pull.mockResolvedValue({ summary: {} });

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'pull',
      remote: 'origin',
      branch: 'main',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('uses raw git for ff-only pull', async () => {
    mockGit.raw.mockResolvedValue('Already up to date.');

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'pull',
      ff_only: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--ff-only');
    expect(result.structuredContent.output).toContain('Already up to date');
  });

  it('uses raw git for pull with refspecs', async () => {
    mockGit.raw.mockResolvedValue('Pull completed.');

    await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'pull',
      refspecs: ['refs/heads/main'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('refs/heads/main');
  });

  it('uses raw git for pull with rebase_mode=merges', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'pull',
      rebase: true,
      rebase_mode: 'merges',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--rebase=merges');
  });
});

describe('git_remotes push action', () => {
  it('performs basic push', async () => {
    mockGit.push.mockResolvedValue({});

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'push',
      remote: 'origin',
      branch: 'main',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('uses raw git for push with refspecs', async () => {
    mockGit.raw.mockResolvedValue('Push completed.');

    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'push',
      remote: 'origin',
      refspecs: ['HEAD:refs/heads/main'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('HEAD:refs/heads/main');
    expect(result.structuredContent.output).toBeTruthy();
  });

  it('uses raw git for atomic push with push_options', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'push',
      atomic: true,
      push_options: ['ci.skip'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--atomic');
    expect(rawArgs).toContain('--push-option=ci.skip');
  });

  it('blocks force push when ALLOW_FORCE_PUSH is false', async () => {
    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'push',
      force: true,
    });
    expect(result.content[0].text).toMatch(/force push is disabled|Error/);
  });

  it('blocks no_verify when ALLOW_NO_VERIFY is false', async () => {
    const result = await callTool(server, 'git_remotes', {
      repo_path: '/repo',
      action: 'push',
      no_verify: true,
    });
    expect(result.content[0].text).toMatch(/no_verify is disabled|Error/);
  });
});

// ---------------------------------------------------------------------------
// git_workspace — stash
// ---------------------------------------------------------------------------
describe('git_workspace stash action', () => {
  it('lists stashes', async () => {
    mockGit.raw.mockResolvedValue('stash@{0}: WIP on main: abc1234 feat: init');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'stash',
      stash_action: 'list',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('saves a stash with message', async () => {
    mockGit.raw.mockResolvedValue('Saved working directory and index state On main: wip');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'stash',
      stash_action: 'save',
      message: 'wip',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('pops a stash', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'stash',
      stash_action: 'pop',
      index: 0,
    });
    expect(result.content[0].type).toBe('text');
  });
});

describe('git_workspace stash_all action', () => {
  it('stashes tracked and untracked files', async () => {
    mockGit.raw.mockResolvedValue('Saved working directory and index state');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'stash_all',
      message: 'everything',
    });
    expect(result.content[0].type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// git_workspace — rebase
// ---------------------------------------------------------------------------
describe('git_workspace rebase action', () => {
  it('starts a rebase onto upstream', async () => {
    mockGit.raw.mockResolvedValue('Rebase completed.');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_action: 'start',
      rebase_upstream: 'main',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('rebase');
    expect(rawArgs).toContain('main');
    expect(result.structuredContent.output).toBeTruthy();
  });

  it('returns error when upstream missing for start', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_action: 'start',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('passes --interactive flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_upstream: 'main',
      rebase_interactive: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('-i');
  });

  it('passes --autosquash flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_upstream: 'main',
      rebase_autosquash: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--autosquash');
  });

  it('passes --rebase-merges flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_upstream: 'main',
      rebase_merges: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--rebase-merges');
  });

  it('passes --onto with branch', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_upstream: 'main',
      rebase_onto: 'v1.0',
      rebase_branch: 'feature/test',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--onto');
    expect(rawArgs).toContain('v1.0');
    expect(rawArgs).toContain('feature/test');
  });

  it('continues a rebase', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_action: 'continue',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--continue');
  });

  it('aborts a rebase', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_action: 'abort',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--abort');
  });

  it('skips a commit during rebase', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'rebase',
      rebase_action: 'skip',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--skip');
  });
});

// ---------------------------------------------------------------------------
// git_workspace — cherry_pick
// ---------------------------------------------------------------------------
describe('git_workspace cherry_pick action', () => {
  it('cherry-picks a single ref', async () => {
    mockGit.raw.mockResolvedValue('Cherry-pick completed.');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_action: 'start',
      cherry_pick_refs: ['abc1234'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('cherry-pick');
    expect(rawArgs).toContain('abc1234');
    expect(result.structuredContent.output).toBeTruthy();
  });

  it('cherry-picks multiple refs', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_refs: ['abc1234', 'def5678'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('abc1234');
    expect(rawArgs).toContain('def5678');
  });

  it('returns error when no ref provided', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_action: 'start',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('passes --mainline flag for merge commits', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_refs: ['abc1234'],
      cherry_pick_mainline: 1,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--mainline');
    expect(rawArgs).toContain('1');
  });

  it('passes -x flag for record origin', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_refs: ['abc1234'],
      cherry_pick_record_origin: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('-x');
  });

  it('passes --no-commit flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_refs: ['abc1234'],
      cherry_pick_no_commit: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--no-commit');
  });

  it('passes --strategy and --strategy-option', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_refs: ['abc1234'],
      cherry_pick_strategy: 'recursive',
      cherry_pick_strategy_options: ['theirs'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--strategy');
    expect(rawArgs).toContain('recursive');
    expect(rawArgs).toContain('--strategy-option');
    expect(rawArgs).toContain('theirs');
  });

  it('continues a cherry-pick', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_action: 'continue',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--continue');
  });

  it('aborts a cherry-pick', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'cherry_pick',
      cherry_pick_action: 'abort',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--abort');
  });
});

// ---------------------------------------------------------------------------
// git_workspace — merge
// ---------------------------------------------------------------------------
describe('git_workspace merge action', () => {
  it('merges a branch', async () => {
    mockGit.raw.mockResolvedValue('Merge completed.');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_action: 'start',
      merge_refs: ['feature/test'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('merge');
    expect(rawArgs).toContain('feature/test');
    expect(result.structuredContent.output).toBeTruthy();
  });

  it('returns error when no ref provided', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_action: 'start',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('passes --no-ff flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_refs: ['feature/test'],
      merge_no_ff: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--no-ff');
  });

  it('passes --ff-only flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_refs: ['feature/test'],
      merge_ff_only: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--ff-only');
  });

  it('passes --squash flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_refs: ['feature/test'],
      merge_squash: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--squash');
  });

  it('passes --no-commit flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_refs: ['feature/test'],
      merge_no_commit: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--no-commit');
  });

  it('passes --strategy and strategy-option', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_refs: ['feature/test'],
      merge_strategy: 'ours',
      merge_strategy_options: ['renormalize'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--strategy');
    expect(rawArgs).toContain('ours');
    expect(rawArgs).toContain('--strategy-option');
    expect(rawArgs).toContain('renormalize');
  });

  it('passes --conflict style', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_refs: ['feature/test'],
      conflict_style: 'diff3',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--conflict=diff3');
  });

  it('continues a merge', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_action: 'continue',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--continue');
  });

  it('aborts a merge', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'merge',
      merge_action: 'abort',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--abort');
  });
});

// ---------------------------------------------------------------------------
// git_workspace — bisect
// ---------------------------------------------------------------------------
describe('git_workspace bisect action', () => {
  it('starts a bisect session', async () => {
    mockGit.raw.mockResolvedValue('Bisecting: 5 revisions left to test');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'bisect',
      bisect_action: 'start',
      bad_ref: 'HEAD',
      good_ref: 'v1.0',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('marks a commit as good', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'bisect',
      bisect_action: 'good',
      ref: 'abc1234',
    });
    expect(result.content[0].type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// git_workspace — worktree
// ---------------------------------------------------------------------------
describe('git_workspace worktree action', () => {
  it('lists worktrees', async () => {
    mockGit.raw.mockResolvedValue('worktree /repo\nHEAD abc1234\nbranch refs/heads/main');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'list',
    });
    expect(result.structuredContent.output).toContain('/repo');
  });

  it('returns placeholder when no worktrees', async () => {
    mockGit.raw.mockResolvedValue('   ');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'list',
    });
    expect(result.structuredContent.output).toBe('No worktrees.');
  });

  it('adds a worktree for a branch', async () => {
    mockGit.raw.mockResolvedValue('Preparing worktree (new branch)');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'add',
      path: '/tmp/feature-wt',
      branch: 'feature/test',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('worktree');
    expect(rawArgs).toContain('add');
    expect(rawArgs).toContain('/tmp/feature-wt');
    expect(result.content[0].type).toBe('text');
  });

  it('adds detached worktree without branch', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'add',
      path: '/tmp/detached-wt',
      worktree_detached: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--detach');
  });

  it('returns error for worktree add without path', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'add',
      branch: 'feature/test',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('returns error for worktree add without branch and not detached', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'add',
      path: '/tmp/wt',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('removes a worktree', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'remove',
      path: '/tmp/feature-wt',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('worktree');
    expect(rawArgs).toContain('remove');
    expect(result.content[0].type).toBe('text');
  });

  it('force-removes a worktree', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'remove',
      path: '/tmp/feature-wt',
      worktree_force: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--force');
  });

  it('returns error for remove without path', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'remove',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('locks a worktree', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'lock',
      path: '/tmp/feature-wt',
      worktree_lock_reason: 'in use',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('lock');
    expect(rawArgs).toContain('--reason');
    expect(rawArgs).toContain('in use');
    expect(result.content[0].type).toBe('text');
  });

  it('unlocks a worktree', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'unlock',
      path: '/tmp/feature-wt',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('unlock');
    expect(result.content[0].type).toBe('text');
  });

  it('returns error for lock/unlock without path', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'lock',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('prunes worktrees', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'prune',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('prune');
    expect(result.content[0].type).toBe('text');
  });

  it('prunes worktrees with expire', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'prune',
      worktree_expire: '1.week.ago',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--expire=1.week.ago');
  });

  it('repairs worktrees', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'repair',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('repair');
    expect(result.content[0].type).toBe('text');
  });

  it('repairs specific worktree paths', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'worktree',
      worktree_action: 'repair',
      paths: ['/tmp/wt1', '/tmp/wt2'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('/tmp/wt1');
    expect(rawArgs).toContain('/tmp/wt2');
  });
});

// ---------------------------------------------------------------------------
// git_workspace — submodule
// ---------------------------------------------------------------------------
describe('git_workspace submodule action', () => {
  it('lists submodules', async () => {
    mockGit.raw.mockResolvedValue('-abc1234 libs/core');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'list',
    });
    expect(result.structuredContent.output).toContain('libs/core');
  });

  it('returns placeholder when no submodules', async () => {
    mockGit.raw.mockResolvedValue('  ');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'list',
    });
    expect(result.structuredContent.output).toBe('No submodules.');
  });

  it('adds a submodule', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'add',
      url: 'https://github.com/foo/bar.git',
      path: 'libs/bar',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('submodule');
    expect(rawArgs).toContain('add');
    expect(result.content[0].type).toBe('text');
  });

  it('returns error for submodule add without url or path', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'add',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('updates submodules with --init --recursive', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'update',
      recursive: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('update');
    expect(rawArgs).toContain('--init');
    expect(rawArgs).toContain('--recursive');
    expect(result.content[0].type).toBe('text');
  });

  it('updates submodules with --remote flag', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'update',
      submodule_remote: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--remote');
  });

  it('updates submodules with depth and jobs', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'update',
      submodule_depth: 1,
      submodule_jobs: 4,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--depth');
    expect(rawArgs).toContain('1');
    expect(rawArgs).toContain('--jobs');
    expect(rawArgs).toContain('4');
  });

  it('updates specific submodule paths', async () => {
    mockGit.raw.mockResolvedValue('');

    await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'update',
      paths: ['libs/core'],
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('--');
    expect(rawArgs).toContain('libs/core');
  });

  it('syncs submodules recursively', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'sync',
      recursive: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('sync');
    expect(rawArgs).toContain('--recursive');
    expect(result.content[0].type).toBe('text');
  });

  it('runs foreach command on submodules', async () => {
    mockGit.raw.mockResolvedValue('Entering libs/core\nfoo');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'foreach',
      command: 'git status',
      recursive: true,
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('foreach');
    expect(rawArgs).toContain('--recursive');
    expect(rawArgs).toContain('git status');
    expect(result.content[0].type).toBe('text');
  });

  it('returns error for foreach without command', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'foreach',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });

  it('sets submodule branch', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'set_branch',
      branch: 'develop',
      path: 'libs/core',
    });
    const [rawArgs] = mockGit.raw.mock.calls[0];
    expect(rawArgs).toContain('set-branch');
    expect(rawArgs).toContain('develop');
    expect(rawArgs).toContain('libs/core');
    expect(result.content[0].type).toBe('text');
  });

  it('returns error for set_branch without branch or path', async () => {
    const result = await callTool(server, 'git_workspace', {
      repo_path: '/repo',
      action: 'submodule',
      submodule_action: 'set_branch',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

// ---------------------------------------------------------------------------
// git_context — remaining actions
// ---------------------------------------------------------------------------
describe('git_context search action', () => {
  it('searches commit history', async () => {
    mockGit.raw.mockResolvedValue('abc1234 feat: add search\ndef5678 fix: search bug');

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'search',
      query: 'search',
      limit: 10,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('output');
  });

  it('returns error when query is missing', async () => {
    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'search',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_context get_config action', () => {
  it('retrieves config values', async () => {
    mockGit.raw.mockResolvedValue('user.name=Jane Doe\nuser.email=jane@example.com');

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'get_config',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('output');
  });

  it('retrieves a specific config key', async () => {
    mockGit.raw.mockResolvedValue('Jane Doe');

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'get_config',
      key: 'user.name',
      response_format: 'json',
    });
    expect(result.structuredContent.output).toBeTruthy();
  });
});

describe('git_context set_config action', () => {
  it('sets a config value', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'set_config',
      key: 'user.name',
      value: 'Jane Doe',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
  });

  it('returns error when key or value missing', async () => {
    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'set_config',
      key: 'user.name',
      response_format: 'json',
    });
    expect(result.content[0].text).toMatch(/Error/);
  });
});

describe('git_context aliases action', () => {
  it('returns configured aliases', async () => {
    mockGit.raw.mockResolvedValue('alias.co=checkout\nalias.st=status');

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'aliases',
      response_format: 'json',
    });
    expect(result.structuredContent.output).toContain('checkout');
  });

  it('returns placeholder when no aliases configured', async () => {
    mockGit.raw.mockResolvedValue('');

    const result = await callTool(server, 'git_context', {
      repo_path: '/repo',
      action: 'aliases',
      response_format: 'json',
    });
    expect(result.structuredContent.output).toBe('No aliases configured.');
  });
});

// ---------------------------------------------------------------------------
// git_status diff_main action
// ---------------------------------------------------------------------------
describe('git_status diff_main action', () => {
  it('returns diff against merge base of main', async () => {
    mockGit.raw
      .mockResolvedValueOnce('mergebase123\n')
      .mockResolvedValue('diff --git a/src/index.ts b/src/index.ts\n+added');
    mockGit.diffSummary.mockResolvedValue({ files: [{}], insertions: 3, deletions: 0 });

    const result = await callTool(server, 'git_status', {
      repo_path: '/repo',
      action: 'diff_main',
      base_branch: 'main',
      response_format: 'json',
    });
    expect(result.structuredContent).toHaveProperty('merge_base');
    expect(result.structuredContent.base_branch).toBe('main');
  });
});
