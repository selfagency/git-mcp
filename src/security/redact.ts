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

const CREDENTIAL_URL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/gi;

/** Masks credentials embedded in URLs (user:pass@host). */
export function redactUrl(input: string): string {
  return input.replace(CREDENTIAL_URL_PATTERN, '$1***@');
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
