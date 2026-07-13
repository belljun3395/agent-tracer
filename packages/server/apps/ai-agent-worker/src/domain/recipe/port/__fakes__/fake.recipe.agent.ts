import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "../recipe.agent.port.js";

/** 레시피 에이전트 포트의 대역이며 정해둔 출력이나 오류를 낸다. */
export class FakeRecipeAgent implements RecipeAgentPort {
    readonly calls: GenerateRecipeCandidatesInput[] = [];
    failure: Error | null = null;

    constructor(
        private readonly output: GenerateRecipeCandidatesOutput,
        private readonly needsApiKey = true,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.needsApiKey;
    }

    generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        this.calls.push(input);
        if (this.failure !== null) return Promise.reject(this.failure);
        return Promise.resolve(this.output);
    }
}
