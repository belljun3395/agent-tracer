export class RuleNotFoundForBackfillError extends Error {
    constructor(public readonly ruleId: string) {
        super(`Rule not found: ${ruleId}`);
        this.name = "RuleNotFoundForBackfillError";
    }
}
