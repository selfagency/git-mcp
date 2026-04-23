export function renderContent(content: unknown, format: 'markdown' | 'json'): string {
  if (format === 'json') {
    // Validate that content can be JSON-stringified
    try {
      return JSON.stringify(content, null, 2);
    } catch (error) {
      throw new Error(`Failed to render content as JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // format === 'markdown'
  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'object' && content !== null) {
    // Object as markdown - convert to string representation
    return JSON.stringify(content, null, 2);
  }

  throw new Error(`Unsupported content type for markdown format: ${typeof content}`);
}

export function renderMarkdownData(markdown: string, data: unknown, format: 'markdown' | 'json'): string {
  if (format === 'markdown') {
    return markdown;
  }

  // format === 'json'
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    throw new Error(`Failed to render data as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
