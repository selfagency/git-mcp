import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGitManPage, searchGitDocs } from '../docs.service.js';

const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('searchGitDocs', () => {
  it('parses result-list search entries', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <ul class="result-list">
            <li>
              <a href="/docs/git-commit">git-commit</a>
              <p class="excerpt">Record changes to repository</p>
            </li>
          </ul>
        </html>
      `,
    } as unknown as Response);

    const result = await searchGitDocs('commit');
    expect(result.query).toBe('commit');
    expect(result.results[0]).toMatchObject({
      title: 'git-commit',
      url: 'https://git-scm.com/docs/git-commit',
    });
  });

  it('falls back to docs links when result-list is absent', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <a href="/docs/git-rebase">git-rebase</a>
        </html>
      `,
    } as unknown as Response);

    const result = await searchGitDocs('rebase');
    expect(result.results[0]?.url).toBe('https://git-scm.com/docs/git-rebase');
  });

  it('throws when upstream returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(searchGitDocs('status')).rejects.toThrow('HTTP 503');
  });
});

describe('fetchGitManPage', () => {
  it('normalizes command and returns markdown body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <article id="main">
            <h1>git-commit</h1>
            <p>Create a commit object.</p>
          </article>
        </html>
      `,
    } as unknown as Response);

    const result = await fetchGitManPage('git commit');
    expect(result).toContain('# git-commit(1)');
    expect(result).toContain('Create a commit object.');
  });

  it('throws a specific message for 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(fetchGitManPage('notacommand')).rejects.toThrow('No man page found');
  });
});
