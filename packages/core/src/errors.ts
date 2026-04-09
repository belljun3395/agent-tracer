export class AppError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ValidationError extends AppError {
    constructor(message: string, code = "VALIDATION_ERROR") {
        super(message, code);
    }
}
export class NotFoundError extends AppError {
    constructor(message: string, code = "NOT_FOUND") {
        super(message, code);
    }
}
export class ConflictError extends AppError {
    constructor(message: string, code = "CONFLICT") {
        super(message, code);
    }
}
