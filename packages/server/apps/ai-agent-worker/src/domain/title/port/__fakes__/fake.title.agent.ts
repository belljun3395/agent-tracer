import type {
    GenerateTitleSuggestionsInput,
    GenerateTitleSuggestionsOutput,
    TitleAgentPort,
} from "../title.agent.port.js";

/** 제목 제안 에이전트 포트의 대역이며 정해둔 출력이나 오류를 낸다. */
export class FakeTitleAgent implements TitleAgentPort {
    readonly calls: GenerateTitleSuggestionsInput[] = [];
    failure: Error | null = null;

    constructor(
        private readonly output: GenerateTitleSuggestionsOutput,
        private readonly needsApiKey = true,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsApiKey;
    }

    generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        this.calls.push(input);
        if (this.failure !== null) return Promise.reject(this.failure);
        return Promise.resolve(this.output);
    }
}
