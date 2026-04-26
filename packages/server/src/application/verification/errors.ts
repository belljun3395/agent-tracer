export class TurnNotFoundError extends Error {
    readonly code = "TURN_NOT_FOUND" as const;
    constructor(public readonly turnId: string) {
        super(`Turn not found: ${turnId}`);
        this.name = "TurnNotFoundError";
    }
}
