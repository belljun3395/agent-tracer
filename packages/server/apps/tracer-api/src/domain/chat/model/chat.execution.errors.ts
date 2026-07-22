import { DomainError } from "@monitor/platform";

export class ChatExecutionIdempotencyConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "chat.execution-idempotency-conflict";

    constructor() {
        super("Client request id was already used with different chat input");
    }
}
