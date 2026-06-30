export class GenerationAlreadyInFlightError extends Error {
    constructor(public readonly jobId: string) {
        super(`A cleanup scan is already in flight (jobId=${jobId}).`);
        this.name = "GenerationAlreadyInFlightError";
    }
}

export class MissingApiKeyError extends Error {
    constructor() {
        super("No Anthropic API key configured. Set anthropic.api_key in Settings.");
        this.name = "MissingApiKeyError";
    }
}

export class NoTasksToScanError extends Error {
    constructor() {
        super("No active tasks to scan.");
        this.name = "NoTasksToScanError";
    }
}
