
export abstract class DomainError extends Error {

    abstract readonly httpStatus: number;

    abstract readonly code: string;

    readonly details?: unknown;

    constructor(message: string, details?: unknown) {
        super(message);

        this.name = new.target.name;
        if (details !== undefined) {
            this.details = details;
        }
    }
}

export abstract class NotFoundError extends DomainError {
    readonly httpStatus = 404;
    readonly code = "not_found";
}

export abstract class ConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "conflict";
}

export abstract class BadRequestError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "bad_request";
}
