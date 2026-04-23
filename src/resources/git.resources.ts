import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toGitError } from '../git/client.js';
import { listBranches } from '../services/branch.service.js';
import { getDiff, getLog, getStatus } from '../services/inspect.service.js';

function decodeRepoPath(value: string): string {
  return decodeURIComponent(value);
}

function stringify(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function buildResourceError(error: unknown, uri: string | URL) {
  const gitError = toGitError(error);
  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            error: gitError.message,
            kind: gitError.kind,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function registerGitResources(server: McpServer): void {
  const templateConfig = { list: undefined };

  server.registerResource(
    'git_repo_status',
    new ResourceTemplate('git+repo://status/{repo_path}', templateConfig),
    {
      title: 'Git Repository Status',
      description: 'Read-only repository status snapshot.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const repoPath = decodeRepoPath(String(variables.repo_path ?? ''));
        const status = await getStatus(repoPath);
        return {
          contents: [{ uri: uri.toString(), mimeType: 'application/json', text: stringify(status) }],
        };
      } catch (error) {
        return buildResourceError(error, uri);
      }
    },
  );

  server.registerResource(
    'git_repo_log',
    new ResourceTemplate('git+repo://log/{repo_path}', templateConfig),
    {
      title: 'Git Repository Log',
      description: 'Read-only recent commit log.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const repoPath = decodeRepoPath(String(variables.repo_path ?? ''));
        const commits = await getLog(repoPath, { limit: 20, offset: 0 });
        return {
          contents: [{ uri: uri.toString(), mimeType: 'application/json', text: stringify({ commits }) }],
        };
      } catch (error) {
        return buildResourceError(error, uri);
      }
    },
  );

  server.registerResource(
    'git_repo_branches',
    new ResourceTemplate('git+repo://branches/{repo_path}', templateConfig),
    {
      title: 'Git Repository Branches',
      description: 'Read-only branch list.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const repoPath = decodeRepoPath(String(variables.repo_path ?? ''));
        const branches = await listBranches(repoPath, true);
        return {
          contents: [{ uri: uri.toString(), mimeType: 'application/json', text: stringify({ branches }) }],
        };
      } catch (error) {
        return buildResourceError(error, uri);
      }
    },
  );

  server.registerResource(
    'git_repo_diff',
    new ResourceTemplate('git+repo://diff/{repo_path}', templateConfig),
    {
      title: 'Git Repository Diff',
      description: 'Read-only unstaged + staged diff views.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const repoPath = decodeRepoPath(String(variables.repo_path ?? ''));
        const [unstaged, staged] = await Promise.all([
          getDiff(repoPath, { mode: 'unstaged', filtered: false }),
          getDiff(repoPath, { mode: 'staged', filtered: false }),
        ]);

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: stringify({ unstaged, staged }),
            },
          ],
        };
      } catch (error) {
        return buildResourceError(error, uri);
      }
    },
  );
}
