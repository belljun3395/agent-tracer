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
