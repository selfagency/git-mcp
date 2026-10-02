import { describe, expect, it } from 'vitest';
import { resolveExecutable, resolveGitShell, shellPath, killTreeCommand } from '../exec.js';

// Pure helpers — every platform-specific behaviour is reached by injecting
// `platform`/`env`/`exists`, so these run identically on Linux CI and Windows.
const present = new Set<string>();
const exists = (p: string) => present.has(p.toLowerCase());

const winEnv = {
  PATH: 'C:\\Program Files\\Git\\cmd;C:\\Users\\dev\\AppData\\Roaming\\npm',
  PATHEXT: '.COM;.EXE;.BAT;.CMD',
} as NodeJS.ProcessEnv;

describe('resolveExecutable', () => {
  it('returns the bare name on non-Windows', () => {
    expect(resolveExecutable('jj', { platform: 'linux', env: {}, exists })).toBe('jj');
  });

  it('finds a .exe on PATH on Windows', () => {
    present.add('c:\\users\\dev\\appdata\\roaming\\npm\\jj.exe');
    expect(resolveExecutable('jj', { platform: 'win32', env: winEnv, exists })).toBe(
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\jj.exe',
    );
  });

  it('falls back to a .cmd shim', () => {
    present.add('c:\\users\\dev\\appdata\\roaming\\npm\\gh.cmd');
    expect(resolveExecutable('gh', { platform: 'win32', env: winEnv, exists })).toBe(
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\gh.cmd',
    );
  });

  it('prefers .exe over .cmd when both are present', () => {
    present.add('c:\\users\\dev\\appdata\\roaming\\npm\\glab.cmd');
    present.add('c:\\users\\dev\\appdata\\roaming\\npm\\glab.exe');
    expect(resolveExecutable('glab', { platform: 'win32', env: winEnv, exists })).toBe(
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\glab.exe',
    );
  });

  it('searches every PATH entry in order', () => {
    present.add('c:\\program files\\git\\cmd\\git-flow.exe');
    expect(resolveExecutable('git-flow', { platform: 'win32', env: winEnv, exists })).toBe(
      'C:\\Program Files\\Git\\cmd\\git-flow.exe',
    );
  });

  it('returns the bare name when nothing matches, so the error names the binary', () => {
    expect(resolveExecutable('missing', { platform: 'win32', env: winEnv, exists })).toBe('missing');
  });

  it('returns the bare name when PATHEXT is unset, defaulting to common extensions', () => {
    present.add('c:\\program files\\git\\cmd\\but.exe');
    expect(resolveExecutable('but', { platform: 'win32', env: { PATH: 'C:\\Program Files\\Git\\cmd' }, exists })).toBe(
      'C:\\Program Files\\Git\\cmd\\but.exe',
    );
  });

  it('leaves an absolute path alone once it exists', () => {
    present.add('c:\\tools\\custom-git-flow.exe');
    expect(resolveExecutable('C:\\tools\\custom-git-flow.exe', { platform: 'win32', env: winEnv, exists })).toBe(
      'C:\\tools\\custom-git-flow.exe',
    );
  });
});

describe('resolveGitShell', () => {
  it('locates sh.exe relative to git --exec-path', () => {
    present.add('c:\\program files\\git\\bin\\sh.exe');
    expect(resolveGitShell('C:\\Program Files\\Git\\mingw64\\libexec\\git-core', { platform: 'win32', exists })).toBe(
      'C:\\Program Files\\Git\\bin\\sh.exe',
    );
  });

  it('returns sh on non-Windows so Git for Windows parity is not needed', () => {
    expect(resolveGitShell('/usr/lib/git-core', { platform: 'linux', exists })).toBe('sh');
  });

  it('returns null when sh.exe is absent', () => {
    expect(resolveGitShell('C:\\nowhere', { platform: 'win32', exists })).toBeNull();
  });
});

describe('shellPath', () => {
  it('converts backslashes so sh does not eat them as escapes', () => {
    expect(shellPath('C:\\Users\\dev\\message.txt')).toBe('C:/Users/dev/message.txt');
  });

  it('leaves POSIX paths untouched', () => {
    expect(shellPath('/tmp/git-mcp-rewrite-ab12/message.txt')).toBe('/tmp/git-mcp-rewrite-ab12/message.txt');
  });
});

describe('killTreeCommand', () => {
  it('uses taskkill on Windows so child processes die with the parent', () => {
    expect(killTreeCommand(4321, 'win32')).toEqual({ file: 'taskkill', args: ['/pid', '4321', '/T', '/F'] });
  });

  it('returns null elsewhere, leaving SIGKILL to the caller', () => {
    expect(killTreeCommand(4321, 'linux')).toBeNull();
  });
});
