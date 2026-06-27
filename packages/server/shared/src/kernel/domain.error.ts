/**
 * Cross-cutting domain error contract.
 *
 * Domain modules throw subclasses of {@link DomainError}; the API gateway's
 * exception filter maps any caught {@link DomainError} to its HTTP response
 * generically (`httpStatus` + `code` + optional `details`). This keeps the
 * filter from importing concrete error classes per domain — a new domain error
 * needs no gateway change, and the HTTP/envelope semantics travel with the
 * domain (the error declares its own category).
 *
 * Domains never write raw status numbers: they extend a semantic subclass
 * ({@link NotFoundError}, {@link ConflictError}, {@link BadRequestError}),
 * which encapsulates the status + envelope code in this one shared place.
 */
export abstract class DomainError extends Error {
    /** HTTP status the gateway responds with. */
    abstract readonly httpStatus: number;
    /** Stable API error code surfaced in the response envelope. */
    abstract readonly code: string;
    /** Optional structured payload merged into the error envelope. */
    readonly details?: unknown;

    constructor(message: string, details?: unknown) {
        super(message);
        // new.target keeps `name` aligned with the concrete subclass without
        // each subclass having to set it explicitly.
        this.name = new.target.name;
        if (details !== undefined) {
            this.details = details;
        }
    }
}

/** Requested resource does not exist → 404. */
export abstract class NotFoundError extends DomainError {
    readonly httpStatus = 404;
    readonly code = "not_found";
}

/** Request conflicts with current state (e.g. already archived) → 409. */
export abstract class ConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "conflict";
}

/** Request is malformed or violates a precondition → 400. */
export abstract class BadRequestError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "bad_request";
}
