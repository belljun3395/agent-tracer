export class TaskNotFoundForGenerationError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "TaskNotFoundForGenerationError";
    }
}

export class TaskHasNoEventsError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task ${taskId} has no events to analyze yet.`);
        this.name = "TaskHasNoEventsError";
    }
}

export class GenerationAlreadyInFlightError extends Error {
    constructor(public readonly jobId: string) {
        super(`A generation job is already in flight (jobId=${jobId}).`);
        this.name = "GenerationAlreadyInFlightError";
    }
}

export class MissingApiKeyError extends Error {
    constructor() {
        super("No Anthropic API key configured. Set anthropic.api_key in Settings.");
        this.name = "MissingApiKeyError";
    }
}
