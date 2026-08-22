// ─── Error Types ──────────────────────────────────────────────────────────

export class ShanuTechXError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ShanuTechXError';
  }
}

export class ApiError extends ShanuTechXError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string = 'API_ERROR',
    public readonly details?: unknown,
  ) {
    super(message, code, status, details);
    this.name = 'ApiError';
  }
}

export class AuthError extends ShanuTechXError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code, 401);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends ShanuTechXError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends ShanuTechXError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/** Raw API error response shape */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: unknown;
}
