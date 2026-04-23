import type { GitError } from '../types.js';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorCategory = 'validation' | 'git_error' | 'security' | 'io_error' | 'internal';

export interface StandardErrorResponse {
  success: false;
  error: {
    message: string;
    kind: string | null;
    severity: ErrorSeverity;
    category: ErrorCategory;
    code?: string;
    details?: unknown;
  };
}

export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export function buildGitErrorResponse(error: unknown, context: string): StandardErrorResponse {
  const gitError =
    error && typeof error === 'object' && 'kind' in error
      ? (error as GitError)
      : { kind: 'unknown' as const, message: String(error) };

  return {
    success: false,
    error: {
      message: `${context}: ${gitError.message}`,
      kind: gitError.kind,
      severity: determineSeverity(gitError.kind),
      category: 'git_error',
      code: gitError.kind ?? undefined,
    },
  };
}

export function buildSuccessResponse<T = unknown>(data: T): StandardSuccessResponse<T> {
  return { success: true, data };
}

export function buildValidationErrorResponse(message: string, field?: string): StandardErrorResponse {
  return {
    success: false,
    error: {
      message: field ? `${field}: ${message}` : message,
      kind: 'validation_error',
      severity: 'high',
      category: 'validation',
      code: 'VALIDATION_ERROR',
      details: field ? { field } : undefined,
    },
  };
}

export function buildNotFoundErrorResponse(resourceType: string, identifier: string): StandardErrorResponse {
  return {
    success: false,
    error: {
      message: `${resourceType} not found: ${identifier}`,
      kind: 'not_found',
      severity: 'medium',
      category: 'git_error',
      code: 'NOT_FOUND',
      details: { resourceType, identifier },
    },
  };
}

export function buildSecurityErrorResponse(message: string, threat?: string): StandardErrorResponse {
  return {
    success: false,
    error: {
      message: `Security violation: ${message}`,
      kind: 'security_error',
      severity: 'critical',
      category: 'security',
      code: 'SECURITY_ERROR',
      details: threat ? { threat } : undefined,
    },
  };
}

function determineSeverity(kind: string | null): ErrorSeverity {
  if (!kind) return 'medium';
  if (['security_error', 'permission', 'path_traversal'].includes(kind)) return 'critical';
  if (['missing_git', 'git_conflict', 'validation_error', 'not_found'].includes(kind)) return 'high';
  return 'medium';
}
