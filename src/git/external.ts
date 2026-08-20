import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface ExternalProbeResult {
  readonly available: boolean;
  readonly version?: string;
  readonly error?: string;
}

/**
 * Probes whether an external VCS binary is installed and returns its version.
 * Uses execFile (no shell interpolation) and never throws — absence is a
 * normal outcome, not an error.
 */
export async function probeBinary(
  binary: string,
  versionArgs: readonly string[] = ['--version'],
): Promise<ExternalProbeResult> {
  try {
    const { stdout } = await execFileAsync(binary, [...versionArgs], { timeout: 5_000 });
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
