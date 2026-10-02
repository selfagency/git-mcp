import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { resolveExecutable } from '../platform/exec.js';

const execFileAsync = promisify(execFile);

const PROBE_CACHE = new Map<string, Promise<ExternalProbeResult>>();

export interface ExternalProbeResult {
  readonly available: boolean;
  readonly version?: string;
  readonly error?: string;
}

/**
 * Probes whether an external VCS binary is installed and returns its version.
 * Uses execFile (no shell interpolation) and never throws — absence is a
 * normal outcome, not an error.
 *
 * The binary name is resolved against PATH/PATHEXT first: on Windows an
 * npm-installed CLI is only a `.cmd` shim, and execFile refuses to spawn those
 * since Node 18.20.2 (CVE-2024-27980).
 *
 * Results are cached per binary+args. Whether a tool is installed does not change
 * while the server runs, and callers such as detectForge probe on every request —
 * without the cache each one pays a process spawn.
 */
export async function probeBinary(
  binary: string,
  versionArgs: readonly string[] = ['--version'],
): Promise<ExternalProbeResult> {
  const key = `${binary} ${versionArgs.join(' ')}`;
  const cached = PROBE_CACHE.get(key);
  if (cached) return cached;
  const pending = spawnProbe(binary, versionArgs);
  PROBE_CACHE.set(key, pending);
  return pending;
}

/** Clears the probe cache, for tests that add or remove a binary mid-run. */
export function resetProbeCache(): void {
  PROBE_CACHE.clear();
}

async function spawnProbe(binary: string, versionArgs: readonly string[]): Promise<ExternalProbeResult> {
  try {
    // Generous: the first spawn of a binary on Windows can sit behind antivirus
    // scanning for seconds. Cached, so it is paid once per process.
    const { stdout } = await execFileAsync(resolveExecutable(binary), [...versionArgs], { timeout: 15_000 });
    return { available: true, version: stdout.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, error: message };
  }
}

/**
 * Detect whether a directory is managed by an external VCS by checking for its
 * marker directory (e.g. `.jj/` for Jujutsu). GitButler is Git-based, so it has
 * no marker of its own — detect it via the `but` binary instead.
 */
export function hasMarkerDir(repoPath: string, marker: string): boolean {
  return existsSync(path.join(repoPath, marker));
}
