import { describe, expect, it } from 'vitest';
import { redactConfigValue, redactError, redactToken, redactUrl } from '../redact.js';

describe('redactUrl', () => {
  it('masks credentials in URLs', () => {
    expect(redactUrl('https://user:pass@github.com/a/b')).toBe('https://***@github.com/a/b');
    expect(redactUrl('x https://a:b@h/p y')).toBe('x https://***@h/p y');
  });

  it('leaves URLs without credentials unchanged', () => {
    expect(redactUrl('https://github.com/a/b')).toBe('https://github.com/a/b');
    expect(redactUrl('no url here')).toBe('no url here');
    // scp-style remote without scheme
    expect(redactUrl('git@github.com:a/b')).toBe('git@github.com:a/b');
  });
});

describe('redactToken', () => {
  it('masks bearer-style and opaque tokens', () => {
    expect(redactToken('Bearer abcdefgh12345678')).toContain('***');
    expect(redactToken('token xyzabc1234567890')).toContain('***');
    expect(redactToken('ghp_12345678901234567890123456789012')).toBe('***');
  });
});

describe('redactConfigValue', () => {
  it('masks sensitive keys', () => {
    expect(redactConfigValue('token', 'abc')).toBe('***');
    expect(redactConfigValue('user.name', 'daniel')).toBe('daniel');
  });
});

describe('redactError', () => {
  it('redacts secrets in error messages', () => {
    expect(redactError(new Error('https://u:secret@h failed'))).toContain('***');
  });
});
