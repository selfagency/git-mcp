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
    ['script', { src: '/webmcp.js' }],
    ['link', { rel: 'api-catalog', href: '/.well-known/api-catalog', type: 'application/json' }],
    [
      'link',
      { rel: 'mcp-server-card', href: '/.well-known/mcp/server-card.json', type: 'application/json' },
    ],
    [
      'link',
      { rel: 'agent-skills', href: '/.well-known/agent-skills/index.json', type: 'application/json' },
    ],
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
