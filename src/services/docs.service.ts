import { CHARACTER_LIMIT } from '../constants.js';

export interface GitDocsSearchResult {
  title: string;
  url: string;
  excerpt: string;
}

export interface GitDocsSearchResponse {
  query: string;
  results: GitDocsSearchResult[];
}

/** Strip HTML tags, decode common entities, and collapse whitespace. */
function stripHtml(html: string): string {
  // Remove <script> and <style> blocks including their content
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/** Extract the content between two markers in an HTML string. */
function extractBetween(html: string, startMarker: RegExp, endMarker: RegExp): string {
  const startMatch = startMarker.exec(html);
  if (!startMatch) return html;
  const startIdx = startMatch.index + startMatch[0].length;
  const remainder = html.slice(startIdx);
  const endMatch = endMarker.exec(remainder);
  return endMatch ? remainder.slice(0, endMatch.index) : remainder;
}

/**
 * Search git-scm.com for documentation matching a query.
 * Uses the same search endpoint as the site's search box.
 */
export async function searchGitDocs(query: string): Promise<GitDocsSearchResponse> {
  const url = `https://git-scm.com/search/results?search=${encodeURIComponent(query)}&language=en`;

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'git-mcp-docs/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`git-scm.com returned HTTP ${response.status}`);
    }
    html = await response.text();
  } catch (err) {
    throw new Error(`Failed to fetch git docs search: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse result entries: each is a <tr> or <li> with a link and excerpt
  // The site returns <li> elements inside <ul class="result-list">
  const results: GitDocsSearchResult[] = [];

  // Extract result items via regex — site uses <li> blocks with <a> and <p>
  const listMatch = /<ul[^>]*class="[^"]*result-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i.exec(html);
  const listHtml = listMatch ? listMatch[1] : html;

  const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(listHtml)) !== null) {
    const item = itemMatch[1]!;
    const linkMatch = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(item);
    if (!linkMatch) continue;

    const href = linkMatch[1]!.trim();
    const title = stripHtml(linkMatch[2]!).trim();
    if (!title) continue;

    const excerptMatch = /<(?:p|span)[^>]*class="[^"]*excerpt[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span)>/i.exec(item);
    const excerpt = excerptMatch ? stripHtml(excerptMatch[1]!).trim() : '';

    const fullUrl = href.startsWith('http') ? href : `https://git-scm.com${href}`;
    results.push({ title, url: fullUrl, excerpt });
  }

  // Fallback: if no structured results, look for plain <a href="/docs/..."> links
  if (results.length === 0) {
    const linkRegex = /<a[^>]+href="(\/docs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = linkRegex.exec(html)) !== null && results.length < 20) {
      const href = m[1]!;
      const title = stripHtml(m[2]!).trim();
      if (!title || seen.has(href)) continue;
      seen.add(href);
      results.push({ title, url: `https://git-scm.com${href}`, excerpt: '' });
    }
  }

  return { query, results };
}

/**
 * Fetch the git man page for a command from git-scm.com.
 * Provide the command without the "git-" prefix (e.g. "commit", "merge").
 */
export async function fetchGitManPage(command: string): Promise<string> {
  // Normalize: strip leading "git " or "git-"
  const normalized = command
    .trim()
    .toLowerCase()
    .replace(/^git[- ]/, '');

  const url = `https://git-scm.com/docs/git-${normalized}`;

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'git-mcp-docs/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `No man page found for "git ${normalized}". ` + `Check the command name or search with action="search".`,
        );
      }
      throw new Error(`git-scm.com returned HTTP ${response.status} for git-${normalized}`);
    }
    html = await response.text();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('No man page')) throw err;
    throw new Error(`Failed to fetch git man page: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Extract the main article content
  const articleContent = extractBetween(
    html,
    /<(?:article|div)[^>]*(?:id="main"|class="[^"]*(?:sect|man-page|article)[^"]*")[^>]*>/i,
    /<\/(?:article|div)>/i,
  );

  const content = stripHtml(articleContent || html);

  const header = `# git-${normalized}(1)\n\nSource: ${url}\n\n`;
  const full = header + content;

  return full.length > CHARACTER_LIMIT
    ? full.slice(0, CHARACTER_LIMIT) + '\n\n[...truncated — content exceeded limit]'
    : full;
}
