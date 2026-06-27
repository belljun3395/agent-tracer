import { BadRequestError, NotFoundError } from "@monitor/shared/kernel/domain.error.js";

export class RuleNotFoundError extends NotFoundError {
    constructor(id: string) {
        super(`Rule ${id} not found`);
    }
}

export class InvalidRuleError extends BadRequestError {
    constructor(message: string) {
        super(message);
    }
}
