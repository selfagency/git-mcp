import { ALLOW_ENTIRE, ENTIRE_BINARY } from '../config.js';
import { hasMarkerDir, probeBinary } from '../git/external.js';

export interface EntireCheckResult {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly version?: string;
  readonly managed: boolean;
  readonly guidance: string;
}

/**
 * Detects whether the Entire CLI is available and whether the repository is
 * Entire-managed (has a `.entire/` directory). Entire captures the context
 * behind agent work (checkpoints, sessions, prompts). Agents should use the
 * `entire` CLI for session/context/attribution queries; git-mcp tools operate
 * on the underlying Git repo and do not expose Entire's context layer.
 */
export async function checkEntire(repoPath: string): Promise<EntireCheckResult> {
  if (!ALLOW_ENTIRE) {
    return {
      enabled: false,
      available: false,
      managed: false,
      guidance: 'Entire awareness is disabled. Set GIT_ALLOW_ENTIRE=true to enable detection.',
    };
  }

  const probe = await probeBinary(ENTIRE_BINARY);
  const managed = hasMarkerDir(repoPath, '.entire');

  if (!probe.available) {
    return {
      enabled: true,
      available: false,
      managed,
      guidance: managed
        ? 'This repository is Entire-managed (has a .entire/ directory) but the `entire` CLI is not ' +
          'installed. Install Entire (https://entire.io) to query session and checkpoint context.'
        : 'The `entire` CLI is not installed. Use git-mcp tools for Git operations.',
    };
  }

  return {
    enabled: true,
    available: true,
    version: probe.version,
    managed,
    guidance: managed
      ? 'This repository is managed by Entire. Use the `entire` CLI for session, checkpoint, and ' +
        'attribution queries (entire why, entire blame, entire search, entire recap). git-mcp tools ' +
        "operate on the git repo and do not expose Entire's context layer."
      : 'Entire (`entire`) is installed but this repository is not Entire-managed. Use git-mcp tools ' +
        'for Git operations.',
  };
}
