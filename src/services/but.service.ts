import { ALLOW_BUT, BUT_BINARY } from '../config.js';
import { probeBinary } from '../git/external.js';

export interface ButCheckResult {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly version?: string;
  readonly guidance: string;
}

/**
 * Detects whether GitButler's `but` CLI is available and returns guidance for
 * the agent. GitButler is a Git-based workspace model (virtual branches), so
 * git-mcp's plain-Git writes can fight GitButler's branch layout — when `but`
 * is present, agents should prefer `but mcp` / `but` commands, and run
 * `but teardown` before falling back to git-mcp tools.
 */
export async function checkBut(): Promise<ButCheckResult> {
  if (!ALLOW_BUT) {
    return {
      enabled: false,
      available: false,
      guidance: 'GitButler awareness is disabled. Set GIT_ALLOW_BUT=true to enable detection of the `but` CLI.',
    };
  }

  const probe = await probeBinary(BUT_BINARY);

  if (!probe.available) {
    return {
      enabled: true,
      available: false,
      guidance:
        'The `but` CLI is not installed. Use git-mcp tools for Git operations. ' +
        'Install GitButler (https://gitbutler.com) to enable GitButler-managed workflows.',
    };
  }

  return {
    enabled: true,
    available: true,
    version: probe.version,
    guidance:
      'GitButler (`but`) is available. Prefer the `but` CLI or `but mcp` server for version control ' +
      'in GitButler-managed repositories. If you must use git-mcp tools on a GitButler-managed repo, ' +
      'run `but teardown` first so plain-Git writes do not conflict with GitButler virtual branches.',
  };
}
