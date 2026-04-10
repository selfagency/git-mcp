import path from 'node:path';

/**
 * Parses --repo or --repo-path from process.argv.
 * Supports both `--repo-path /path` and `--repo-path=/path` forms.
 */
function parseCliRepoPath(): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if ((arg === '--repo' || arg === '--repo-path') && i + 1 < args.length) {
      return args[i + 1];
    }
    const match = /^--repo(?:-path)?=(.+)$/.exec(arg);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

const configured: string | undefined = process.env['GIT_REPO_PATH'] ?? parseCliRepoPath();

/**
 * Server-level default repository path, resolved to an absolute path.
 * Set via the GIT_REPO_PATH environment variable or --repo / --repo-path CLI argument.
 */
export const DEFAULT_REPO_PATH: string | undefined = configured ? path.resolve(configured) : undefined;

/**
 * Resolves the effective repository path for a tool request.
 * Uses the provided path if given, otherwise falls back to the server default.
 * Throws a clear error if neither is available.
 */
export function resolveRepoPath(repoPath: string | undefined): string {
  const resolved = repoPath ?? DEFAULT_REPO_PATH;
  if (!resolved) {
    throw new Error(
      'No repository path provided. Pass repo_path in the tool request, ' +
        'or configure a server default via the GIT_REPO_PATH environment variable ' +
        'or the --repo / --repo-path CLI argument.',
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Hook bypass
// ---------------------------------------------------------------------------

/**
 * When true, tools accept a `no_verify` parameter that passes --no-verify to
 * git commit and git push, bypassing pre-commit / pre-push hooks.
 * Enable via: GIT_ALLOW_NO_VERIFY=true
 */
export const ALLOW_NO_VERIFY: boolean = process.env['GIT_ALLOW_NO_VERIFY'] === 'true';

// ---------------------------------------------------------------------------
// Force push
// ---------------------------------------------------------------------------

/**
 * When true, tools accept a `force` parameter that passes --force to git push.
 * Note: this bypasses local safety checks only. Remote branch protection
 * (e.g. GitHub/GitLab protected branches) is enforced server-side regardless.
 * Enable via: GIT_ALLOW_FORCE_PUSH=true
 */
export const ALLOW_FORCE_PUSH: boolean = process.env['GIT_ALLOW_FORCE_PUSH'] === 'true';

// ---------------------------------------------------------------------------
// Flow hook execution
// ---------------------------------------------------------------------------

/**
 * When true, git_flow may execute git-flow-next-compatible hook and filter
 * programs discovered from git config or repository hook locations.
 * Enable via: GIT_ALLOW_FLOW_HOOKS=true
 */
export const ALLOW_FLOW_HOOKS: boolean = process.env['GIT_ALLOW_FLOW_HOOKS'] === 'true';

// ---------------------------------------------------------------------------
// Commit / tag signing
// ---------------------------------------------------------------------------

/**
 * Default signing key (GPG key ID, SSH public key path, or empty to use git's
 * configured user.signingkey). Set via: GIT_SIGNING_KEY=<value>
 */
export const DEFAULT_SIGNING_KEY: string | undefined = process.env['GIT_SIGNING_KEY'] || undefined;

/**
 * Signing format: openpgp | ssh | x509
 * Set via: GIT_SIGNING_FORMAT=ssh
 */
export const DEFAULT_SIGNING_FORMAT: string | undefined = process.env['GIT_SIGNING_FORMAT'] || undefined;

/**
 * Auto-sign all commits produced by this server.
 * Enable via: GIT_AUTO_SIGN_COMMITS=true
 */
export const AUTO_SIGN_COMMITS: boolean = process.env['GIT_AUTO_SIGN_COMMITS'] === 'true';

/**
 * Auto-sign all tags produced by this server.
 * Enable via: GIT_AUTO_SIGN_TAGS=true
 */
export const AUTO_SIGN_TAGS: boolean = process.env['GIT_AUTO_SIGN_TAGS'] === 'true';
