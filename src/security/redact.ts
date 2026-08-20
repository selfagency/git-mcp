/**
 * Centralized secret redaction for errors, logs, and subprocess output.
 * Every error path and log line should route through these helpers so
 * credentials, tokens, and signing keys never leak to MCP clients.
 */

const TOKEN_PATTERNS: RegExp[] = [
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:Bearer|token|auth)\s+[A-Za-z0-9._~+/=-]{8,}\b/gi,
  /\b[A-Za-z0-9_-]{40,}\b/g,
];

// Masks userinfo (user[:pass]) embedded in URLs, e.g.
// https://user:secret@host/path -> https://***@host/path.
// Implemented as a linear string scan instead of a regex to avoid
// backtracking and duplicate-character-class smells.
export function redactUrl(input: string): string {
  let out = input;
  let cursor = 0;
  while (cursor < out.length) {
    const at = out.indexOf('@', cursor);
    if (at === -1) break;
    // Find the scheme start for the authority this '@' belongs to.
    const scheme = out.slice(0, at).lastIndexOf('://');
    if (scheme !== -1 && !/[\s/@]/.test(out.slice(scheme + 3, at))) {
      out = out.slice(0, scheme + 3) + '***@' + out.slice(at + 1);
      // Advance past the '***@' we just inserted (the @ is at scheme+6).
      cursor = scheme + 7;
    } else {
      cursor = at + 1;
    }
  }
  return out;
}

/** Masks bearer tokens, API keys, and long opaque secrets. */
export function redactToken(input: string): string {
  let out = input;
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, '***');
  }
  return out;
}

/** Masks sensitive git config values (signing keys, tokens, credentials). */
export function redactConfigValue(key: string, value: string): string {
  if (/(token|secret|key|password|credential|auth)/i.test(key)) {
    return '***';
  }
  return value;
}

/** Normalizes any error message through all redactors. */
export function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactToken(redactUrl(message));
}
