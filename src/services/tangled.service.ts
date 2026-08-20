import { ALLOW_TANGLED } from '../config.js';
import { getGit } from '../git/client.js';

export interface TangledCheckResult {
  readonly enabled: boolean;
  readonly tangled: boolean;
  readonly guidance: string;
}

/**
 * Detects whether the repository's origin remote points at a Tangled host
 * (tangled.org or a self-hosted knot). Tangled is a decentralized Git host on
 * the AT Protocol — git transport (push/pull/clone) works normally, but there
 * is no PR/MR surface. Agents should use git-mcp transport tools as usual.
 */
export async function checkTangled(repoPath: string): Promise<TangledCheckResult> {
  if (!ALLOW_TANGLED) {
    return {
      enabled: false,
      tangled: false,
      guidance: 'Tangled awareness is disabled. Set GIT_ALLOW_TANGLED=true to enable detection.',
    };
  }

  const git = getGit(repoPath);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin') ?? remotes[0];
  const url = origin?.refs?.fetch ?? '';

  const isTangled = /tangled\.org|\.tangled\.|knot/i.test(url);

  return {
    enabled: true,
    tangled: isTangled,
    guidance: isTangled
      ? 'This repository is hosted on Tangled (decentralized Git hosting on the AT Protocol). ' +
        'Git transport (push/pull/clone) works normally via git-mcp tools. Tangled supports pull ' +
        'requests, but they are managed through the web UI — no documented REST API or CLI exists ' +
        'for creating/merging them, so use git-mcp for repository operations and the Tangled web ' +
        'UI for pull requests.'
      : 'This repository is not hosted on Tangled. Use git-mcp tools normally.',
  };
}
