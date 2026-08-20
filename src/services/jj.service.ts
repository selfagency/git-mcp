import { ALLOW_JJ, JJ_BINARY } from '../config.js';
import { hasMarkerDir, probeBinary } from '../git/external.js';

export interface JjCheckResult {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly version?: string;
  readonly managed: boolean;
  readonly guidance: string;
}

/**
 * Detects whether Jujutsu's `jj` CLI is available and whether the repository is
 * jj-managed (has a `.jj/` directory). Jujutsu is a distinct VCS with its own
 * change model (working-copy commit, bookmarks, operation log) layered over a
 * `.git` repo. git-mcp's plain-Git tools operate on the underlying `.git` and
 * will not reflect jj's model, so agents should prefer the `jj` CLI directly.
 */
export async function checkJj(repoPath: string): Promise<JjCheckResult> {
  if (!ALLOW_JJ) {
    return {
      enabled: false,
      available: false,
      managed: false,
      guidance: 'Jujutsu awareness is disabled. Set GIT_ALLOW_JJ=true to enable detection of the `jj` CLI.',
    };
  }

  const probe = await probeBinary(JJ_BINARY);
  const managed = hasMarkerDir(repoPath, '.jj');

  if (!probe.available) {
    return {
      enabled: true,
      available: false,
      managed,
      guidance: managed
        ? 'This repository is jj-managed (has a .jj/ directory) but the `jj` CLI is not installed. ' +
          'Install Jujutsu (https://jj-vcs.dev) before making VCS changes.'
        : 'The `jj` CLI is not installed. Use git-mcp tools for Git operations.',
    };
  }

  return {
    enabled: true,
    available: true,
    version: probe.version,
    managed,
    guidance: managed
      ? 'This repository is managed by Jujutsu (`jj`). Prefer the `jj` CLI for all version control ' +
        "operations — git-mcp tools operate on the underlying .git and will not reflect jj's " +
        'change model (working-copy commit, bookmarks, operation log).'
      : 'Jujutsu (`jj`) is installed but this repository is not jj-managed. Use git-mcp tools for ' + 'Git operations.',
  };
}
