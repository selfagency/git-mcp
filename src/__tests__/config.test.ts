import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalArgv = [...process.argv];
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.argv = [...originalArgv];
  process.env = { ...originalEnv };
  delete process.env['GIT_REPO_PATH'];
});

afterEach(() => {
  process.argv = [...originalArgv];
  process.env = { ...originalEnv };
});

describe('config module', () => {
  it('reads default repo path from --repo-path CLI arg', async () => {
    process.argv = ['node', 'src/index.ts', '--repo-path', '/tmp/repo'];
    const config = await import('../config.js');
    expect(config.DEFAULT_REPO_PATH).toBe(path.resolve('/tmp/repo'));
  });

  it('reads default repo path from --repo= CLI arg', async () => {
    process.argv = ['node', 'src/index.ts', '--repo=/tmp/alt'];
    const config = await import('../config.js');
    expect(config.DEFAULT_REPO_PATH).toBe(path.resolve('/tmp/alt'));
  });

  it('prefers GIT_REPO_PATH env over CLI arg', async () => {
    process.argv = ['node', 'src/index.ts', '--repo-path', '/tmp/cli'];
    process.env['GIT_REPO_PATH'] = '/tmp/env';
    const config = await import('../config.js');
    expect(config.DEFAULT_REPO_PATH).toBe(path.resolve('/tmp/env'));
  });

  it('resolveRepoPath uses passed value when provided', async () => {
    const config = await import('../config.js');
    expect(config.resolveRepoPath('/tmp/direct')).toBe('/tmp/direct');
  });

  it('resolveRepoPath throws when neither explicit nor default exists', async () => {
    const config = await import('../config.js');
    expect(() => config.resolveRepoPath(undefined)).toThrow('No repository path provided');
  });
});
