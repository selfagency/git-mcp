import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GITHUB_TOKEN, GITLAB_TOKEN, FORGEJO_TOKEN, BITBUCKET_TOKEN } from '../config.js';
import { redactError } from '../security/redact.js';
import { detectForge, type ForgeContext } from './forge.service.js';

const execFileAsync = promisify(execFile);

export interface CreatePrOptions {
  readonly title: string;
  readonly body?: string;
  readonly base?: string;
  readonly head?: string;
}

export interface ListPrOptions {
  readonly state?: 'open' | 'closed' | 'all';
  readonly limit?: number;
}

export interface MergePrOptions {
  readonly number: number;
  readonly method?: 'merge' | 'squash' | 'rebase';
}

export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly url?: string;
}

function getToken(context: ForgeContext): string | undefined {
  switch (context.provider) {
    case 'github':
      return GITHUB_TOKEN;
    case 'gitlab':
      return GITLAB_TOKEN;
    case 'forgejo':
    case 'gitea':
      return FORGEJO_TOKEN;
    case 'bitbucket':
      return BITBUCKET_TOKEN;
    default:
      return undefined;
  }
}

async function runCli(cli: string, args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync(cli, args, { cwd, timeout: 30_000 });
  return stdout.trim();
}

async function runRest(
  context: ForgeContext,
  method: 'POST' | 'GET' | 'PUT',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const token = getToken(context);
  if (!token) {
    throw new Error(`No token configured for ${context.provider}. Set the appropriate *_TOKEN env var.`);
  }

  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const url = `${context.baseUrl}/api/v1/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.repo)}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(30_000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Forge API error (${response.status}): ${redactError(body)}`);
  }

  return response.json();
}

async function createViaCli(context: ForgeContext, options: CreatePrOptions, cwd: string): Promise<PullRequest> {
  const base = options.base ?? 'main';
  const head = options.head ?? 'HEAD';

  if (context.cli === 'gh') {
    const args = ['pr', 'create', '--base', base, '--head', head, '--title', options.title];
    if (options.body) args.push('--body', options.body);
    const url = await runCli('gh', args, cwd);
    return { number: 0, title: options.title, state: 'open', url };
  }

  if (context.cli === 'glab') {
    const args = ['mr', 'create', '--source-branch', head, '--target-branch', base, '--title', options.title];
    if (options.body) args.push('--description', options.body);
    const url = await runCli('glab', args, cwd);
    return { number: 0, title: options.title, state: 'open', url };
  }

  if (context.cli === 'tea') {
    const args = ['pulls', 'create', '--title', options.title, '--base', base, '--head', head];
    if (options.body) args.push('--description', options.body);
    const url = await runCli('tea', args, cwd);
    return { number: 0, title: options.title, state: 'open', url };
  }

  throw new Error(`No CLI available for provider ${context.provider}.`);
}

async function createRest(context: ForgeContext, options: CreatePrOptions): Promise<PullRequest> {
  const base = options.base ?? 'main';
  const head = options.head ?? 'HEAD';
  const result = (await runRest(context, 'POST', '/pulls', {
    title: options.title,
    body: options.body,
    base,
    head,
  })) as { number: number; title: string; state: string; html_url?: string };

  return {
    number: result.number,
    title: result.title,
    state: result.state,
    url: result.html_url,
  };
}

async function listCli(context: ForgeContext, options: ListPrOptions, cwd: string): Promise<PullRequest[]> {
  if (context.cli === 'gh') {
    const args = ['pr', 'list', '--state', options.state ?? 'open', '--json', 'number,title,state,url'];
    const output = await runCli('gh', args, cwd);
    return (JSON.parse(output) as Array<{ number: number; title: string; state: string; url: string }>).map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.url,
    }));
  }

  if (context.cli === 'glab') {
    const args = ['mr', 'list', '--state', options.state ?? 'open'];
    const output = await runCli('glab', args, cwd);
    return output
      .split('\n')
      .filter(Boolean)
      .map(line => ({ number: 0, title: line, state: options.state ?? 'open', url: '' }));
  }

  if (context.cli === 'tea') {
    const args = ['pulls', 'list', '--state', options.state ?? 'open'];
    const output = await runCli('tea', args, cwd);
    return output
      .split('\n')
      .filter(Boolean)
      .map(line => ({ number: 0, title: line, state: options.state ?? 'open', url: '' }));
  }

  throw new Error(`No CLI available for provider ${context.provider}.`);
}

async function listRest(context: ForgeContext, options: ListPrOptions): Promise<PullRequest[]> {
  const state = options.state ?? 'open';
  const result = (await runRest(context, 'GET', `/pulls?state=${state}`)) as Array<{
    number: number;
    title: string;
    state: string;
    html_url?: string;
  }>;

  return result.map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    url: pr.html_url,
  }));
}

async function mergeCli(context: ForgeContext, options: MergePrOptions, cwd: string): Promise<string> {
  if (context.cli === 'gh') {
    const args = ['pr', 'merge', String(options.number)];
    if (options.method) args.push(`--${options.method}`);
    return runCli('gh', args, cwd);
  }

  if (context.cli === 'glab') {
    const args = ['mr', 'merge', String(options.number)];
    if (options.method) args.push(`--${options.method}`);
    return runCli('glab', args, cwd);
  }

  if (context.cli === 'tea') {
    const args = ['pulls', 'merge', String(options.number)];
    if (options.method) args.push(`--${options.method}`);
    return runCli('tea', args, cwd);
  }

  throw new Error(`No CLI available for provider ${context.provider}.`);
}

async function mergeRest(context: ForgeContext, options: MergePrOptions): Promise<string> {
  const method = options.method ?? 'merge';
  await runRest(context, 'PUT', `/pulls/${options.number}/merge`, { merge_method: method });
  return `Merged PR #${options.number} (${method}).`;
}

export async function createPullRequest(repoPath: string, options: CreatePrOptions): Promise<PullRequest> {
  const context = await detectForge(repoPath);
  if (context.provider === 'unknown') {
    throw new Error('Cannot detect forge provider from remote URL.');
  }
  if (context.cli) {
    return createViaCli(context, options, repoPath);
  }
  return createRest(context, options);
}

export async function listPullRequests(repoPath: string, options: ListPrOptions): Promise<PullRequest[]> {
  const context = await detectForge(repoPath);
  if (context.provider === 'unknown') {
    throw new Error('Cannot detect forge provider from remote URL.');
  }
  if (context.cli) {
    return listCli(context, options, repoPath);
  }
  return listRest(context, options);
}

export async function mergePullRequest(repoPath: string, options: MergePrOptions): Promise<string> {
  const context = await detectForge(repoPath);
  if (context.provider === 'unknown') {
    throw new Error('Cannot detect forge provider from remote URL.');
  }
  if (context.cli) {
    return mergeCli(context, options, repoPath);
  }
  return mergeRest(context, options);
}
