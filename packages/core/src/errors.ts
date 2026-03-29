/**
 * Unified application error hierarchy for @monitor/core.
 *
 * All domain errors extend `AppError` so callers can handle them with a
 * single `instanceof AppError` check or switch on `error.code` for finer
 * grained handling.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain in compiled output (required for `instanceof`
    // checks when targeting ES5 / CommonJS).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when user-supplied input fails domain validation. */
export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message, code);
  }
}

/** Thrown when a requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message: string, code = "NOT_FOUND") {
    super(message, code);
  }
}

/** Thrown when an operation conflicts with existing state (e.g. duplicate). */
export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT") {
    super(message, code);
  }
}
