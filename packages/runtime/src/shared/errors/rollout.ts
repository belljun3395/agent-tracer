/**
 * Error types thrown by the Codex rollout tail observer.
 * Filter callers can branch on instanceof to differentiate recoverable
 * (timeout, missing marker) from fatal (parse errors) conditions.
 */
export class RolloutNotFoundError extends Error {
    readonly sessionId: string;
    readonly timeoutMs: number;

    constructor(sessionId: string, timeoutMs: number) {
        super(`Codex rollout file not found for session ${sessionId} within ${timeoutMs}ms`);
        this.name = "RolloutNotFoundError";
        this.sessionId = sessionId;
        this.timeoutMs = timeoutMs;
    }
}

export class RolloutTimeoutError extends Error {
    constructor(message = "Rollout tail aborted") {
        super(message);
        this.name = "RolloutTimeoutError";
    }
}

export class MissingSessionMarkerError extends Error {
    constructor(message = "No runtime session marker found. Start Codex once so hooks can persist a latest-session hint.") {
        super(message);
        this.name = "MissingSessionMarkerError";
    }
}

export class InvalidRolloutArgumentError extends Error {
    constructor(argumentName: string) {
        super(`Invalid rollout argument: ${argumentName} must be non-empty`);
        this.name = "InvalidRolloutArgumentError";
    }
}
