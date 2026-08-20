import path from 'node:path';

/**
 * Parses a boolean env value, accepting true/1/yes (case-insensitive).
 * Anything else (including unset) is false.
 */
function envBool(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Parses --repo or --repo-path from process.argv.
 * Supports both `--repo-path /path` and `--repo-path=/path` forms.
 */
function parseCliRepoPath(): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';

    // Handle --repo / --repo-path with space
    if ((arg === '--repo' || arg === '--repo-path') && i + 1 < args.length) {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`--repo/--repo-path requires a non-empty value. Received: "${value}"`);
      }
      return value;
    }

    // Handle --repo=/path or --repo-path=/path
    const match = /^--repo(?:-path)?=(.+)$/.exec(arg);
    if (match?.[1]) {
      const value = match[1];
      if (!value || value.startsWith('-')) {
        throw new Error(`--repo/--repo-path requires a non-empty value. Received: "${value}"`);
      }
      return value;
    }
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
export const ALLOW_NO_VERIFY: boolean = envBool(process.env['GIT_ALLOW_NO_VERIFY']);

// ---------------------------------------------------------------------------
// Force push
// ---------------------------------------------------------------------------

/**
 * When true, tools accept a `force` parameter that passes --force to git push.
 * Note: this bypasses local safety checks only. Remote branch protection
 * (e.g. GitHub/GitLab protected branches) is enforced server-side regardless.
 * Enable via: GIT_ALLOW_FORCE_PUSH=true
 */
export const ALLOW_FORCE_PUSH: boolean = envBool(process.env['GIT_ALLOW_FORCE_PUSH']);

// ---------------------------------------------------------------------------
// Flow hook execution
// ---------------------------------------------------------------------------

/**
 * When true, git_flow may execute git-flow-next-compatible hook and filter
 * programs discovered from git config or repository hook locations.
 * Enable via: GIT_ALLOW_FLOW_HOOKS=true
 */
export const ALLOW_FLOW_HOOKS: boolean = envBool(process.env['GIT_ALLOW_FLOW_HOOKS']);

// ---------------------------------------------------------------------------
// GitButler / Jujutsu awareness
// ---------------------------------------------------------------------------

/**
 * When true, tools that detect and guide toward GitButler (`but`) and Jujutsu
 * (`jj`) are enabled. These are read-only probes that tell agents whether to
 * prefer the external VCS CLI/MCP over git-mcp's plain-Git tools.
 * Enable via: GIT_ALLOW_BUT=true / GIT_ALLOW_JJ=true
 */
export const ALLOW_BUT: boolean = envBool(process.env['GIT_ALLOW_BUT']);
export const ALLOW_JJ: boolean = envBool(process.env['GIT_ALLOW_JJ']);

/**
 * Override the executable path for the `but` and `jj` binaries.
 * Set via: BUT_BINARY=<path> / JJ_BINARY=<path>
 */
export const BUT_BINARY: string = process.env['BUT_BINARY'] || 'but';
export const JJ_BINARY: string = process.env['JJ_BINARY'] || 'jj';

/**
 * When true, tools that detect and guide toward Tangled and Entire are enabled.
 * Enable via: GIT_ALLOW_TANGLED=true / GIT_ALLOW_ENTIRE=true
 */
export const ALLOW_TANGLED: boolean = envBool(process.env['GIT_ALLOW_TANGLED']);
export const ALLOW_ENTIRE: boolean = envBool(process.env['GIT_ALLOW_ENTIRE']);

/**
 * Override the executable path for the `entire` binary.
 * Set via: ENTIRE_BINARY=<path>
 */
export const ENTIRE_BINARY: string = process.env['ENTIRE_BINARY'] || 'entire';

// ---------------------------------------------------------------------------
// Forge tokens (PR support)
// ---------------------------------------------------------------------------

/**
 * Tokens for forge PR operations. Used as a fallback when the provider CLI
 * (gh/glab/tea) is not installed locally.
 * Set via: GITHUB_TOKEN / GITLAB_TOKEN / FORGEJO_TOKEN / BITBUCKET_TOKEN
 */
export const GITHUB_TOKEN: string | undefined = process.env['GITHUB_TOKEN'] || undefined;
export const GITLAB_TOKEN: string | undefined = process.env['GITLAB_TOKEN'] || undefined;
export const FORGEJO_TOKEN: string | undefined = process.env['FORGEJO_TOKEN'] || undefined;
export const BITBUCKET_TOKEN: string | undefined = process.env['BITBUCKET_TOKEN'] || undefined;

/**
 * Explicit forge provider override for self-hosted instances that cannot be
 * detected from the remote hostname. Values: github | gitlab | forgejo | gitea | bitbucket
 * Set via: GIT_FORGE_PROVIDER=<provider>
 */
export type ForgeProviderName = 'github' | 'gitlab' | 'forgejo' | 'gitea' | 'bitbucket';
const FORGE_PROVIDERS: readonly ForgeProviderName[] = ['github', 'gitlab', 'forgejo', 'gitea', 'bitbucket'];
const rawProvider = process.env['GIT_FORGE_PROVIDER'];
export const GIT_FORGE_PROVIDER: ForgeProviderName | undefined = rawProvider
  ? FORGE_PROVIDERS.includes(rawProvider as ForgeProviderName)
    ? (rawProvider as ForgeProviderName)
    : undefined
  : undefined;

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
export const AUTO_SIGN_COMMITS: boolean = envBool(process.env['GIT_AUTO_SIGN_COMMITS']);

/**
 * Auto-sign all tags produced by this server.
 * Enable via: GIT_AUTO_SIGN_TAGS=true
 */
export const AUTO_SIGN_TAGS: boolean = envBool(process.env['GIT_AUTO_SIGN_TAGS']);
