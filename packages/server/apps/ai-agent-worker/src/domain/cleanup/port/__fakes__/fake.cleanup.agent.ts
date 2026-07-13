import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "../cleanup.agent.port.js";

/** 정리 제안 에이전트 포트의 대역이며 정해둔 출력이나 오류를 낸다. */
export class FakeCleanupAgent implements CleanupAgentPort {
    readonly calls: GenerateCleanupSuggestionsInput[] = [];
    failure: Error | null = null;

    constructor(
        private readonly output: GenerateCleanupSuggestionsOutput,
        private readonly needsApiKey = true,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsApiKey;
    }

    generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        this.calls.push(input);
        if (this.failure !== null) return Promise.reject(this.failure);
        return Promise.resolve(this.output);
    }
}
