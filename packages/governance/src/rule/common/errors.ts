export class RuleNotFoundError extends Error {
    constructor(id: string) {
        super(`Rule ${id} not found`);
        this.name = "RuleNotFoundError";
    }
}

export class InvalidRuleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidRuleError";
    }
}
