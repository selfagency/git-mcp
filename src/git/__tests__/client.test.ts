import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the fs module so we control existsSync and statSync
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
}));

// Mock simple-git
vi.mock('simple-git', () => ({
  simpleGit: vi.fn().mockReturnValue({ _isMocked: true }),
}));

import { existsSync, statSync } from 'node:fs';
import { simpleGit } from 'simple-git';
import { getGit, toGitError, validatePathArgument, validatePathArguments, validateRepoPath } from '../client.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as ReturnType<typeof statSync>);
});

// ---------------------------------------------------------------------------
// toGitError
// ---------------------------------------------------------------------------
describe('toGitError', () => {
  it('classifies git not found errors', () => {
    const err = new Error('git not found');
    expect(toGitError(err).kind).toBe('missing_git');
  });

  it('classifies ENOENT as missing_git', () => {
    expect(toGitError(new Error('ENOENT: no such file'))).toMatchObject({ kind: 'missing_git' });
  });

  it('classifies permission denied errors', () => {
    expect(toGitError(new Error('permission denied'))).toMatchObject({ kind: 'permission' });
  });

  it('classifies EACCES as permission', () => {
    expect(toGitError(new Error('EACCES something'))).toMatchObject({ kind: 'permission' });
  });

  it('classifies merge conflict errors', () => {
    expect(toGitError(new Error('CONFLICT detected'))).toMatchObject({ kind: 'git_conflict' });
  });

  it('classifies rebase in progress', () => {
    expect(toGitError(new Error('rebase in progress'))).toMatchObject({ kind: 'git_conflict' });
  });

  it('classifies network errors', () => {
    expect(toGitError(new Error('could not resolve host: github.com'))).toMatchObject({ kind: 'network' });
  });

  it('classifies timed out as network', () => {
    expect(toGitError(new Error('timed out connecting to server'))).toMatchObject({ kind: 'network' });
  });

  it('defaults to unknown for unrecognized errors', () => {
    expect(toGitError(new Error('something weird'))).toMatchObject({ kind: 'unknown' });
  });

  it('handles non-Error values', () => {
    expect(toGitError('oops')).toMatchObject({ kind: 'unknown', message: 'oops' });
  });

  it('preserves the error message', () => {
    const err = new Error('permission denied due to EPERM');
    expect(toGitError(err).message).toBe('permission denied due to EPERM');
  });
});

// ---------------------------------------------------------------------------
// validateRepoPath
// ---------------------------------------------------------------------------
describe('validateRepoPath', () => {
  it('throws when path does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => validateRepoPath('/nonexistent')).toThrow('Repository path does not exist');
  });

  it('throws when path is not a directory', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false } as ReturnType<typeof statSync>);
    expect(() => validateRepoPath('/some/file.txt')).toThrow('Repository path is not a directory');
  });

  it('returns normalized path when it exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    // statSync default mock returns isDirectory: true
    const result = validateRepoPath('/some/valid/path');
    expect(result).toBe(path.resolve('/some/valid/path'));
  });
});

// ---------------------------------------------------------------------------
// getGit
// ---------------------------------------------------------------------------
describe('getGit', () => {
  it('returns a simpleGit instance for a valid path', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const git = getGit('/repo');
    expect(simpleGit).toHaveBeenCalled();
    expect(git).toMatchObject({ _isMocked: true });
  });

  it('throws when path does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => getGit('/nonexistent')).toThrow('Repository path does not exist');
  });
});

// ---------------------------------------------------------------------------
// validatePathArgument(s)
// ---------------------------------------------------------------------------
describe('validatePathArgument', () => {
  it('accepts a normal relative path', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(validatePathArgument('/repo', 'src/index.ts')).toBe('src/index.ts');
  });

  it('normalizes windows separators', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(validatePathArgument('/repo', String.raw`src\index.ts`)).toBe('src/index.ts');
  });

  it('rejects absolute paths', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(() => validatePathArgument('/repo', '/etc/passwd')).toThrow('escapes repository root');
  });

  it('rejects parent traversal', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(() => validatePathArgument('/repo', '../secret.txt')).toThrow('escapes repository root');
  });
});

describe('validatePathArguments', () => {
  it('validates a path list', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(validatePathArguments('/repo', ['a.ts', 'dir/b.ts'])).toEqual(['a.ts', 'dir/b.ts']);
  });
});

// ---------------------------------------------------------------------------
// toGitError – extended platform-specific pattern coverage
// ---------------------------------------------------------------------------
describe('toGitError extended patterns', () => {
  // missing_git
  it('classifies Windows "is not recognized" error', () => {
    expect(toGitError(new Error("'git' is not recognized as an internal or external command"))).toMatchObject({
      kind: 'missing_git',
    });
  });

  it('classifies "cannot find" as missing_git', () => {
    expect(toGitError(new Error('cannot find git in PATH'))).toMatchObject({ kind: 'missing_git' });
  });

  it('classifies "bad interpreter" as missing_git', () => {
    expect(toGitError(new Error('git: bad interpreter: No such file or directory'))).toMatchObject({
      kind: 'missing_git',
    });
  });

  // permission
  it('classifies EPERM as permission', () => {
    expect(toGitError(new Error('EPERM: operation not permitted'))).toMatchObject({ kind: 'permission' });
  });

  it('classifies Windows "Access denied" as permission', () => {
    expect(toGitError(new Error('Access denied: C:\\repo'))).toMatchObject({ kind: 'permission' });
  });

  it('classifies "Read-only file system" as permission', () => {
    expect(toGitError(new Error('Read-only file system'))).toMatchObject({ kind: 'permission' });
  });

  it('classifies "insufficient permissions" as permission', () => {
    expect(toGitError(new Error('insufficient permissions to access repository'))).toMatchObject({
      kind: 'permission',
    });
  });

  // git_conflict
  it('classifies "cherry-pick in progress" as git_conflict', () => {
    expect(toGitError(new Error('cherry-pick in progress'))).toMatchObject({ kind: 'git_conflict' });
  });

  it('classifies "not possible to fast-forward" as git_conflict', () => {
    expect(toGitError(new Error('not possible to fast-forward, aborting'))).toMatchObject({ kind: 'git_conflict' });
  });

  it('classifies "automatic merge failed" as git_conflict', () => {
    expect(toGitError(new Error('automatic merge failed; fix conflicts and then commit the result'))).toMatchObject({
      kind: 'git_conflict',
    });
  });

  it('classifies "unmerged paths" as git_conflict', () => {
    expect(toGitError(new Error('You have unmerged paths'))).toMatchObject({ kind: 'git_conflict' });
  });

  // network
  it('classifies "Connection refused" as network', () => {
    expect(toGitError(new Error('Connection refused: github.com:443'))).toMatchObject({ kind: 'network' });
  });

  it('classifies "Host unreachable" as network', () => {
    expect(toGitError(new Error('Host unreachable: github.com'))).toMatchObject({ kind: 'network' });
  });

  it('classifies "Network unreachable" as network', () => {
    expect(toGitError(new Error('Network unreachable'))).toMatchObject({ kind: 'network' });
  });

  it('classifies "failed to connect" as network', () => {
    expect(toGitError(new Error('failed to connect to remote'))).toMatchObject({ kind: 'network' });
  });

  it('classifies "connection timeout" as network', () => {
    expect(toGitError(new Error('connection timeout after 30s'))).toMatchObject({ kind: 'network' });
  });

  it('classifies "remote error" as network', () => {
    expect(toGitError(new Error('remote error: unexpected end of file'))).toMatchObject({ kind: 'network' });
  });

  // case-insensitive
  it('matches patterns case-insensitively', () => {
    expect(toGitError(new Error('PERMISSION DENIED'))).toMatchObject({ kind: 'permission' });
    expect(toGitError(new Error('NETWORK ERROR'))).toMatchObject({ kind: 'network' });
  });
});
