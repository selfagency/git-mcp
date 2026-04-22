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
