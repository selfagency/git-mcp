/**
 * Centralized argument/ref/path validation to prevent Git option injection.
 * Git interprets leading-dash values as options, so refs, branch names, and
 * other user inputs must be validated before being passed to git.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

/** Rejects NUL/control chars and leading-dash values that Git would treat as options. */
export function assertSafeArg(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} cannot be empty.`);
  }
  if (trimmed.startsWith('-')) {
    throw new Error(`${name} cannot start with '-'.`);
  }
  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new Error(`${name} contains invalid control characters.`);
  }
  return trimmed;
}

/** Validates a Git ref-like value (branch, tag, commit, HEAD~N). */
export function assertSafeRef(ref: string, name: string): string {
  const safe = assertSafeArg(ref, name);
  // Reject refs that are clearly option-like or contain whitespace.
  if (/\s/.test(safe)) {
    throw new Error(`${name} cannot contain whitespace.`);
  }
  return safe;
}

/** Validates a remote name (alphanumeric, dash, underscore, dot). */
export function assertSafeRemoteName(name: string): string {
  const safe = assertSafeArg(name, 'remote');
  if (!/^[a-zA-Z0-9._-]+$/.test(safe)) {
    throw new Error(`Invalid remote name: ${name}`);
  }
  return safe;
}

/** Validates a git command name for docs lookup (lowercase alphanumeric + dash). */
export function assertSafeCommandName(command: string): string {
  const safe = assertSafeArg(command, 'command');
  if (!/^[a-z][a-z0-9-]*$/.test(safe)) {
    throw new Error(`Invalid command name: ${command}`);
  }
  return safe;
}
