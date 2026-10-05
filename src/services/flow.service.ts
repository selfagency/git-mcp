import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GIT_FLOW_BINARY } from '../config.js';
import { resolveExecutable } from '../platform/exec.js';
import { buildFlowArgs, type FlowArgOptions } from './flow-args.js';

const execFileAsync = promisify(execFile);

export interface FlowActionResult {
  readonly markdown: string;
}

const INSTALL_HINT = [
  'git-flow-next is not installed.',
  '  macOS:          brew install git-flow-next',
  '  other platforms: https://github.com/gittower/git-flow-next/releases',
  'Or point GIT_FLOW_BINARY at an existing binary.',
].join('\n');

/**
 * Runs a raw `git flow` subcommand and returns its stdout.
 *
 * Exported for `git_worktree`'s branch-addressed actions, which target the
 * `worktree` command group directly rather than going through the tool schema.
 * Callers are responsible for building argv; anything user-supplied belongs in
 * an argv array, never a shell string.
 */
export async function runGitFlow(repoPath: string, args: readonly string[]): Promise<string> {
  const binary = resolveExecutable(GIT_FLOW_BINARY);

  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(binary, [...args], { cwd: repoPath, timeout: 10 * 60_000 }));
  } catch (error) {
    const failure = error as { message?: string; stdout?: string; stderr?: string };
    const message = failure.message ?? String(error);
    if (/ENOENT|not found/i.test(message)) {
      throw new Error(INSTALL_HINT);
    }
    const stderr = failure.stderr ? `\n${failure.stderr}` : '';
    throw new Error(`git flow ${args.join(' ')} failed: ${message}${stderr}`);
  }
  return stdout.trim();
}

/**
 * Runs a git-flow operation through the git-flow-next CLI.
 *
 * This is a thin argv wrapper, not a reimplementation. git-flow-next owns the
 * workflow semantics — the finish state machine, backmerges, and (since 2.1)
 * worktree lifecycle — so they stay correct as the CLI evolves instead of
 * drifting behind it here.
 */
export async function runFlowAction(repoPath: string, options: FlowArgOptions): Promise<FlowActionResult> {
  const args = buildFlowArgs(options);
  const output = await runGitFlow(repoPath, args);
  return { markdown: output || 'git flow completed with no output.' };
}
