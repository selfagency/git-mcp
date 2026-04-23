import pkg from '../package.json' with { type: 'json' };

export const SERVER_NAME = 'git-mcp-server';
export const SERVER_VERSION: string = pkg.version;
export const CHARACTER_LIMIT = 25_000;

export const EXCLUDED_DIFF_DIRECTORIES = ['node_modules/', '.yarn/', '.astro/', 'dist/'] as const;

export const EXCLUDED_DIFF_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'webp',
  'bmp',
  'tiff',
  'mp4',
  'mp3',
  'wav',
  'ogg',
  'pdf',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'zip',
  'tar',
  'gz',
] as const;

// Workflow state management
export const WORKFLOW_STATE_FILENAME = 'gitworkflow.state.json';
export const WORKFLOW_STATE_DIR = '.git'; // Store in .git to avoid committing state

// Error message templates
export const ERROR_TEMPLATES = {
  NO_REPO_PATH:
    'No repository path provided. Pass repo_path in the tool request, or configure a server default via GIT_REPO_PATH environment variable or --repo / --repo-path CLI argument.',
  HOOK_BYPASS_DISABLED:
    'no_verify is disabled on this server. Set GIT_ALLOW_NO_VERIFY=true to permit bypassing git hooks.',
  FORCE_PUSH_DISABLED: 'force is disabled on this server. Set GIT_ALLOW_FORCE_PUSH=true to permit force push.',
  FLOW_HOOKS_DISABLED:
    'git_flow hooks and filters are disabled on this server. Set GIT_ALLOW_FLOW_HOOKS=true to permit execution.',
} as const;
