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
  toGitError: (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: 'unknown', message: msg };
  },
}));

import { registerAdvancedTools } from '../../src/tools/advanced.tools.js';
import { registerBranchTools } from '../../src/tools/branch.tools.js';
import { registerContextTools } from '../../src/tools/context.tools.js';
import { registerInspectTools } from '../../src/tools/inspect.tools.js';
import { registerRemoteTools } from '../../src/tools/remote.tools.js';
import { registerWriteTools } from '../../src/tools/write.tools.js';

// ---------------------------------------------------------------------------
// Helper to create a test MCP server and invoke a tool
// ---------------------------------------------------------------------------
function createTestServer() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerInspectTools(server);
  registerWriteTools(server);
  registerBranchTools(server);
  registerRemoteTools(server);
  registerAdvancedTools(server);
  registerContextTools(server);
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

    const result = await callTool(server, 'git_status', { repo_path: '/repo', response_format: 'json' });
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
// git_log
// ---------------------------------------------------------------------------
describe('git_log tool', () => {
  it('returns commit log', async () => {
    const logLine = 'abc1234\tJohn\tjohn@example.com\t2024-01-01T00:00:00Z\tfeat: init';
    mockGit.raw.mockResolvedValue(logLine);

    const result = await callTool(server, 'git_log', {
      repo_path: '/repo',
      limit: 10,
      offset: 0,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('commits');
  });
});

// ---------------------------------------------------------------------------
// git_diff
// ---------------------------------------------------------------------------
describe('git_diff tool', () => {
  it('returns diff content', async () => {
    mockGit.diffSummary.mockResolvedValue({ files: [{}, {}], insertions: 5, deletions: 2 });
    mockGit.raw.mockResolvedValue('diff --git a/src/foo.ts b/src/foo.ts\n+added line');

    const result = await callTool(server, 'git_diff', {
      repo_path: '/repo',
      mode: 'unstaged',
      filtered: false,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('summary');
  });
});

// ---------------------------------------------------------------------------
// git_add
// ---------------------------------------------------------------------------
describe('git_add tool', () => {
  it('stages all files', async () => {
    mockGit.add.mockResolvedValue('');
    const result = await callTool(server, 'git_add', { repo_path: '/repo', all: true });
    // render() JSON-serialises non-string payloads; check structuredContent instead
    expect(result.structuredContent.message).toBe('Staged all changes.');
  });

  it('stages specific paths', async () => {
    mockGit.add.mockResolvedValue('');
    const result = await callTool(server, 'git_add', { repo_path: '/repo', paths: ['a.ts'] });
    expect(result.structuredContent.message).toBe('Staged 1 path(s).');
  });
});

// ---------------------------------------------------------------------------
// git_commit
// ---------------------------------------------------------------------------
describe('git_commit tool', () => {
  it('commits with message', async () => {
    mockGit.commit.mockResolvedValue({ commit: 'abc1234' });
    const result = await callTool(server, 'git_commit', {
      repo_path: '/repo',
      message: 'feat: test',
      all: false,
      amend: false,
      no_edit: false,
    });
    expect(result.content[0].text).toContain('abc1234');
  });
});

// ---------------------------------------------------------------------------
// git_list_branches
// ---------------------------------------------------------------------------
describe('git_list_branches tool', () => {
  it('lists branches', async () => {
    mockGit.branch.mockResolvedValue({ all: ['main', 'dev'], current: 'main', branches: {} });
    const result = await callTool(server, 'git_list_branches', {
      repo_path: '/repo',
      all: false,
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result.structuredContent).toHaveProperty('branches');
  });
});

// ---------------------------------------------------------------------------
// git_remote
// ---------------------------------------------------------------------------
describe('git_remote tool', () => {
  it('lists remotes', async () => {
    mockGit.getRemotes.mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/a/b.git', push: 'https://github.com/a/b.git' } },
    ]);
    const result = await callTool(server, 'git_remote', {
      repo_path: '/repo',
      action: 'list',
      name: 'origin',
    });
    expect(result.content[0].type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// git_tag
// ---------------------------------------------------------------------------
describe('git_tag tool', () => {
  it('lists tags', async () => {
    mockGit.tags.mockResolvedValue({ all: ['v1.0', 'v2.0'] });
    const result = await callTool(server, 'git_tag', {
      repo_path: '/repo',
      action: 'list',
    });
    expect(result.content[0].text).toContain('v1.0');
  });

  it('creates a lightweight tag', async () => {
    mockGit.addTag.mockResolvedValue('');
    const result = await callTool(server, 'git_tag', {
      repo_path: '/repo',
      action: 'create',
      name: 'v3.0',
    });
    expect(result.content[0].text).toContain('v3.0');
  });
});

// ---------------------------------------------------------------------------
// git_context_summary
// ---------------------------------------------------------------------------
describe('git_context_summary tool', () => {
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

    const result = await callTool(server, 'git_context_summary', {
      repo_path: '/repo',
      response_format: 'json',
    });
    expect(result.content[0].type).toBe('text');
    expect(result).toHaveProperty('structuredContent');
  });
});
