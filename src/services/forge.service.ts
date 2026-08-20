import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GIT_FORGE_PROVIDER } from '../config.js';
import { getGit } from '../git/client.js';

const execFileAsync = promisify(execFile);

export type ForgeProvider = 'github' | 'gitlab' | 'forgejo' | 'gitea' | 'bitbucket' | 'unknown';

export interface ForgeContext {
  readonly provider: ForgeProvider;
  readonly owner: string;
  readonly repo: string;
  readonly baseUrl: string;
  readonly cli?: string;
}

const CLI_BY_PROVIDER: Record<Exclude<ForgeProvider, 'unknown'>, string> = {
  github: 'gh',
  gitlab: 'glab',
  forgejo: 'tea',
  gitea: 'tea',
  bitbucket: 'bb',
};

/** Known public forge hosts. Self-hosted instances are not guessed from hostname. */
const PUBLIC_HOST_PROVIDER: Record<string, ForgeProvider> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'codeberg.org': 'forgejo',
  'gitea.com': 'gitea',
  'bitbucket.org': 'bitbucket',
};

function parseRemoteUrl(url: string): { host: string; owner: string; repo: string } | null {
  // SSH: git@github.com:owner/repo.git
  const sshMatch = /^(?:[^@]+@)?([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  if (sshMatch) {
    return { host: sshMatch[1], owner: sshMatch[2], repo: sshMatch[3] };
  }

  // HTTPS: https://github.com/owner/repo.git
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { host: parsed.hostname, owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
    }
  } catch {
    // fall through
  }

  throw new Error(`Cannot parse remote URL: ${url}`);
}

function detectProvider(host: string): ForgeProvider {
  const h = host.toLowerCase();
  // Explicit env override wins for self-hosted instances.
  if (GIT_FORGE_PROVIDER) return GIT_FORGE_PROVIDER as ForgeProvider;
  return PUBLIC_HOST_PROVIDER[h] ?? 'unknown';
}

async function cliAvailable(cli: string): Promise<boolean> {
  try {
    await execFileAsync(cli, ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export async function detectForge(repoPath: string): Promise<ForgeContext> {
  const git = getGit(repoPath);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin') ?? remotes[0];
  if (!origin?.refs?.fetch) {
    return { provider: 'unknown', owner: '', repo: '', baseUrl: '', cli: undefined };
  }

  const parsed = parseRemoteUrl(origin.refs.fetch);
  if (!parsed) {
    return { provider: 'unknown', owner: '', repo: '', baseUrl: '', cli: undefined };
  }
  const { host, owner, repo } = parsed;
  const provider = detectProvider(host);
  const cli = provider !== 'unknown' ? CLI_BY_PROVIDER[provider] : undefined;
  const cliPresent = cli ? await cliAvailable(cli) : false;

  return {
    provider,
    owner,
    repo,
    baseUrl: `https://${host}`,
    cli: cliPresent ? cli : undefined,
  };
}
