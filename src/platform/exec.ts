import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Windows / Git for Windows compatibility helpers.
 *
 * Every function takes `platform`, `env`, and `exists` as injectable
 * parameters so the Windows branches are testable from Linux CI.
 */

/**
 * Extensions tried when resolving a bare command name on Windows, in the
 * order Windows itself searches them: real executables before shell shims.
 * Lower-cased because the Windows filesystem is case-insensitive, so probing
 * lowercase matches `PATHEXT`'s usual uppercase form.
 */
const DEFAULT_PATHEXT = '.com;.exe;.bat;.cmd';

export interface PlatformContext {
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly exists?: (candidate: string) => boolean;
}

function context(options: PlatformContext): {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  exists: (candidate: string) => boolean;
} {
  return {
    platform: options.platform ?? process.platform,
    env: options.env ?? process.env,
    exists: options.exists ?? existsSync,
  };
}

/**
 * Resolves a command name to an absolute path on Windows.
 *
 * `execFile` has refused to spawn `.cmd`/`.bat` since Node 18.20.2 / 20.12.2
 * / 21.7.3 (CVE-2024-27980). npm-installed CLIs (`gh`, `glab`, `jj`, `but`,
 * `git-flow`) exist on Windows only as `.cmd` shims, so spawning them by bare
 * name fails with EINVAL. Resolving to an absolute path first is the fix that
 * keeps the shell out of the picture.
 *
 * Returns the bare name unchanged when nothing is found, so the resulting
 * ENOENT error names the binary the user actually asked for.
 */
export function resolveExecutable(command: string, options: PlatformContext = {}): string {
  const { platform, env, exists } = context(options);
  if (platform !== 'win32') {
    return command;
  }

  // An explicit path is the user's decision — only probe it for a suffix.
  if (command.includes('\\') || command.includes('/')) {
    return exists(command) ? command : (withFirstExistingSuffix(command, env, exists) ?? command);
  }

  for (const dir of (env['PATH'] ?? '').split(';')) {
    if (!dir) continue;
    const candidate = path.win32.join(dir, command);
    const resolved = exists(candidate) ? candidate : withFirstExistingSuffix(candidate, env, exists);
    if (resolved) {
      return resolved;
    }
  }

  return command;
}

function withFirstExistingSuffix(
  base: string,
  env: NodeJS.ProcessEnv,
  exists: (candidate: string) => boolean,
): string | undefined {
  for (const extension of (env['PATHEXT'] ?? DEFAULT_PATHEXT).toLowerCase().split(';')) {
    const trimmed = extension.trim();
    if (!trimmed) continue;
    const candidate = base + trimmed;
    if (exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Locates the `sh` used to run Git for Windows shell scripts (git-flow hooks,
 * `--msg-filter` bodies).
 *
 * Git for Windows installs `sh.exe` at `<install>/bin/sh.exe`, while
 * `git --exec-path` points at `<install>/mingw64/libexec/git-core`. On other
 * platforms `sh` is already on PATH.
 */
export function resolveGitShell(gitExecPath: string, options: PlatformContext = {}): string | null {
  const { platform, exists } = context(options);
  if (platform !== 'win32') {
    return 'sh';
  }

  // <install>/mingw64/libexec/git-core -> <install>/bin/sh.exe
  const installRoot = path.win32.resolve(gitExecPath, '..', '..', '..');
  const candidate = path.win32.join(installRoot, 'bin', 'sh.exe');
  return exists(candidate) ? candidate : null;
}

/**
 * Normalises a path for embedding in a POSIX shell script.
 *
 * Git for Windows ships `sh`, so `[ ... ]` and `$( )` in a `--msg-filter` body
 * parse fine — but a backslash path inside double quotes has its `\U`, `\T`
 * sequences eaten as shell escapes. Forward slashes work in both worlds.
 */
export function shellPath(target: string): string {
  return target.replaceAll('\\', '/');
}

/**
 * Command that kills a process *and its descendants*, or null when the
 * platform's own signal already does that.
 *
 * Windows has no SIGKILL and no process groups; `child.kill()` leaves any
 * grandchildren running, which keeps repository locks held after a hook times
 * out.
 */
export function killTreeCommand(
  pid: number,
  options: PlatformContext | NodeJS.Platform = {},
): { file: string; args: string[] } | null {
  const platform = typeof options === 'string' ? options : (options.platform ?? process.platform);
  if (platform !== 'win32') {
    return null;
  }
  return { file: 'taskkill', args: ['/pid', String(pid), '/T', '/F'] };
}
