import { defineConfig } from 'vitepress';

const SITE_URL = 'https://git-mcp.self.agency';

export default defineConfig({
  title: 'git-mcp',
  description: 'A production-grade Git MCP server — powering AI-assisted Git workflows',
  lang: 'en-US',
  base: '/',

  sitemap: {
    hostname: SITE_URL,
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    [
      'script',
      {},
      `
      (() => {
        if (typeof navigator === 'undefined' || !navigator.modelContext) {
          return;
        }

        try {
          navigator.modelContext.registerTool({
            name: 'open_git_mcp_docs',
            title: 'Open git-mcp docs',
            description: 'Open git-mcp documentation pages in this tab.',
            inputSchema: {
              type: 'object',
              properties: {
                section: {
                  type: 'string',
                  enum: ['getting-started', 'tools', 'resources'],
                  default: 'getting-started'
                }
              },
              additionalProperties: false
            },
            annotations: {
              readOnlyHint: true
            },
            execute: async (input) => {
              const section = input?.section ?? 'getting-started';
              const routes = {
                'getting-started': '/guide/getting-started',
                tools: '/tools/',
                resources: '/guide/resources'
              };

              const targetPath = routes[section] ?? routes['getting-started'];
              const targetUrl = new URL(targetPath, window.location.origin).toString();

              window.location.assign(targetUrl);

              return {
                ok: true,
                url: targetUrl
              };
            }
          });
        } catch {
          // Ignore duplicate registration or unsupported runtime errors.
        }
      })();
      `,
    ],
    [
      'link',
      {
        rel: 'api-catalog',
        href: '/.well-known/api-catalog',
        type: 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      },
    ],
    [
      'link',
      { rel: 'mcp-server-card', href: '/.well-known/mcp/server-card.json', type: 'application/json' },
    ],
    ['link', { rel: 'service-desc', href: '/.well-known/mcp/server-card.json', type: 'application/json' }],
    ['link', { rel: 'service-doc', href: '/guide/getting-started', type: 'text/html' }],
    ['link', { rel: 'describedby', href: '/.well-known/openid-configuration', type: 'application/json' }],
    [
      'link',
      { rel: 'agent-skills', href: '/.well-known/agent-skills/index.json', type: 'application/json' },
    ],
    ['meta', { 'http-equiv': 'Link', content: '</.well-known/api-catalog>; rel="api-catalog"' }],
    ['meta', { name: 'content-signal', content: 'ai-train=no, search=yes, ai-input=no' }],
    ['meta', { name: 'theme-color', content: '#f05133' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'git-mcp' }],
    ['meta', { property: 'og:url', content: SITE_URL }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'A production-grade Git MCP server — powering AI-assisted Git workflows',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Tools', link: '/tools/' },
      { text: 'Developer', link: '/development/architecture' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/selfagency/git-mcp/releases' },
          { text: 'Contributing', link: '/development/contributing' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'MCP Resources', link: '/guide/resources' },
            { text: 'Safety & Permissions', link: '/guide/safety' },
          ],
        },
      ],
      '/tools/': [
        {
          text: 'Tool Reference',
          items: [
            { text: 'Overview', link: '/tools/' },
            { text: 'Inspect', link: '/tools/inspect' },
            { text: 'Write', link: '/tools/write' },
            { text: 'Branches', link: '/tools/branch' },
            { text: 'Remote', link: '/tools/remote' },
            { text: 'Advanced', link: '/tools/advanced' },
            { text: 'Context & Config', link: '/tools/context' },
            { text: 'LFS', link: '/tools/lfs' },
            { text: 'Git Flow', link: '/tools/flow' },
            { text: 'Documentation', link: '/tools/docs' },
          ],
        },
      ],
      '/development/': [
        {
          text: 'Development',
          items: [
            { text: 'Architecture', link: '/development/architecture' },
            { text: 'Contributing', link: '/development/contributing' },
            { text: 'Testing', link: '/development/testing' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/selfagency/git-mcp' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Daniel Sieradski',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/selfagency/git-mcp/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
