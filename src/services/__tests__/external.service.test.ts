import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../git/external.js', () => ({
  probeBinary: vi.fn(),
  hasMarkerDir: vi.fn(),
}));

vi.mock('../../config.js', () => ({
  ALLOW_BUT: true,
  BUT_BINARY: 'but',
  ALLOW_JJ: true,
  JJ_BINARY: 'jj',
}));

import { probeBinary, hasMarkerDir } from '../../git/external.js';
import { checkBut } from '../but.service.js';
import { checkJj } from '../jj.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkBut', () => {
  it('reports unavailable when but is not installed', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: false, error: 'ENOENT' });
    const result = await checkBut();
    expect(result.available).toBe(false);
    expect(result.guidance).toContain('not installed');
  });

  it('reports available and recommends but mcp / but teardown', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: true, version: 'but 0.22.0' });
    const result = await checkBut();
    expect(result.available).toBe(true);
    expect(result.version).toBe('but 0.22.0');
    expect(result.guidance).toContain('but mcp');
    expect(result.guidance).toContain('but teardown');
  });
});

describe('checkJj', () => {
  it('reports jj-managed repo and recommends jj CLI', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: true, version: 'jj 0.20.0' });
    vi.mocked(hasMarkerDir).mockReturnValue(true);
    const result = await checkJj('/repo');
    expect(result.available).toBe(true);
    expect(result.managed).toBe(true);
    expect(result.guidance).toContain('jj');
  });

  it('reports non-jj repo when no .jj marker', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: true, version: 'jj 0.20.0' });
    vi.mocked(hasMarkerDir).mockReturnValue(false);
    const result = await checkJj('/repo');
    expect(result.managed).toBe(false);
    expect(result.guidance).toContain('not jj-managed');
  });

  it('reports jj-managed repo without jj CLI installed', async () => {
    vi.mocked(probeBinary).mockResolvedValue({ available: false, error: 'ENOENT' });
    vi.mocked(hasMarkerDir).mockReturnValue(true);
    const result = await checkJj('/repo');
    expect(result.available).toBe(false);
    expect(result.managed).toBe(true);
    expect(result.guidance).toContain('not installed');
  });
});
