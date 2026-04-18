export function renderContent(content: unknown, format: 'markdown' | 'json'): string {
  if (typeof content === 'string' && format === 'markdown') {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

export function renderMarkdownData(markdown: string, data: unknown, format: 'markdown' | 'json'): string {
  if (format === 'markdown') {
    return markdown;
  }

  return JSON.stringify(data, null, 2);
}
