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
