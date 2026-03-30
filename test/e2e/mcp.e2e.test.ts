/**
 * E2E tests for the git-mcp server.
 *
 * These tests spawn the real server as a child process and communicate with it
 * over JSON-RPC via stdin/stdout (the MCP stdio transport), using the same
 * protocol a real MCP client would use.
 *
 * The git_ping tool requires NO git binary and is used to validate that the
 * server starts, handles requests, and responds correctly.
 */
import { ChildProcess, spawn } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** Write a JSON-RPC request line to the server's stdin. */
function writeRequest(child: ChildProcess, request: JsonRpcRequest): void {
  child.stdin!.write(JSON.stringify(request) + '\n');
}

/** Collect lines from the server's stdout until a matching JSON-RPC response is found. */
function waitForResponse(child: ChildProcess, id: number, timeoutMs = 8000): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for response id=${id}`)), timeoutMs);

    function onData(chunk: Buffer) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const response = parsed as JsonRpcResponse;
        if (response && response.id === id) {
          clearTimeout(timer);
          child.stdout!.off('data', onData);
          resolve(response);
        }
      }
    }

    child.stdout!.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let server: ChildProcess;
let requestId = 1;

function nextId() {
  return requestId++;
}

beforeAll(async () => {
  // Start the server process using tsx so TS is transpiled on-the-fly
  server = spawn('node', ['--import', 'tsx/esm', 'src/index.ts'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // Wait for the MCP initialize handshake
  const initId = nextId();
  writeRequest(server, {
    jsonrpc: '2.0',
    id: initId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.0' },
    },
  });

  const initResponse = await waitForResponse(server, initId);
  if (initResponse.error) {
    throw new Error(`initialize failed: ${initResponse.error.message}`);
  }
}, 15000);

afterAll(() => {
  server?.kill('SIGTERM');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP server E2E - git_ping', () => {
  it('responds to git_ping with the default message', async () => {
    const id = nextId();
    writeRequest(server, {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'git_ping',
        arguments: { message: 'pong' },
      },
    });

    const response = await waitForResponse(server, id);
    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('git-mcp-server: pong');
  });

  it('responds to git_ping with a custom message', async () => {
    const id = nextId();
    writeRequest(server, {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'git_ping',
        arguments: { message: 'hello' },
      },
    });

    const response = await waitForResponse(server, id);
    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toBe('git-mcp-server: hello');
  });
});

describe('MCP server E2E - tools/list', () => {
  it('returns a non-empty list of tools', async () => {
    const id = nextId();
    writeRequest(server, {
      jsonrpc: '2.0',
      id,
      method: 'tools/list',
      params: {},
    });

    const response = await waitForResponse(server, id);
    expect(response.error).toBeUndefined();
    const result = response.result as { tools: Array<{ name: string }> };
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);

    // Core tools must be present
    const names = result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('git_ping');
    expect(names).toContain('git_status');
    expect(names).toContain('git_log');
    expect(names).toContain('git_commit');
    expect(names).toContain('git_list_branches');
    expect(names).toContain('git_tag');
    expect(names).toContain('git_stash');
    expect(names).toContain('git_fetch');
    expect(names).toContain('git_context_summary');
  });
});

describe('MCP server E2E - error handling', () => {
  it('returns a response (not a server crash) for an unknown tool', async () => {
    const id = nextId();
    writeRequest(server, {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'git_nonexistent_tool_12345',
        arguments: {},
      },
    });

    // The server must remain alive and return either an RPC error or a result;
    // it must not crash or time out
    const response = await waitForResponse(server, id);
    expect(response.id).toBe(id);
    // A well-behaved MCP server returns either error or result, never nothing
    expect(response.error !== undefined || response.result !== undefined).toBe(true);
  });

  it('returns a tool-level error for a non-existent repo path', async () => {
    const id = nextId();
    writeRequest(server, {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'git_status',
        arguments: { repo_path: '/absolutely/nonexistent/repo/__test__', response_format: 'json' },
      },
    });

    const response = await waitForResponse(server, id);
    // The tool should catch the error and return it in content (not crash the server)
    const result = response.result as { content: Array<{ text: string }> } | undefined;
    if (result?.content) {
      expect(result.content[0].text).toMatch(/Error|does not exist|not a git/i);
    } else {
      expect(response.error).toBeDefined();
    }
  });
});
