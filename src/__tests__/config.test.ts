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
  const testRoot = '/Users/test/git-mcp-fixtures';

  it('reads default repo path from --repo-path CLI arg', async () => {
    process.argv = ['node', 'src/index.ts', '--repo-path', `${testRoot}/repo`];
    const config = await import('../config.js');
    expect(config.DEFAULT_REPO_PATH).toBe(path.resolve(`${testRoot}/repo`));
  });

  it('reads default repo path from --repo= CLI arg', async () => {
    process.argv = ['node', 'src/index.ts', `--repo=${testRoot}/alt`];
    const config = await import('../config.js');
    expect(config.DEFAULT_REPO_PATH).toBe(path.resolve(`${testRoot}/alt`));
  });

  it('prefers GIT_REPO_PATH env over CLI arg', async () => {
    process.argv = ['node', 'src/index.ts', '--repo-path', `${testRoot}/cli`];
    process.env['GIT_REPO_PATH'] = `${testRoot}/env`;
    const config = await import('../config.js');
    expect(config.DEFAULT_REPO_PATH).toBe(path.resolve(`${testRoot}/env`));
  });

  it('resolveRepoPath uses passed value when provided', async () => {
    const config = await import('../config.js');
    expect(config.resolveRepoPath(`${testRoot}/direct`)).toBe(`${testRoot}/direct`);
  });

  it('resolveRepoPath throws when neither explicit nor default exists', async () => {
    const config = await import('../config.js');
    expect(() => config.resolveRepoPath(undefined)).toThrow('No repository path provided');
  });
});
