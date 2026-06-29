export class RecipeScanAlreadyInFlightError extends Error {
    constructor(public readonly jobId: string) {
        super(`A recipe scan is already in flight (jobId=${jobId}).`);
        this.name = "RecipeScanAlreadyInFlightError";
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
        super("No tasks match the scan filters.");
        this.name = "NoTasksToScanError";
    }
}
