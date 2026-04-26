import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";
import type {
    ILlmClient,
    LlmCompletionRequest,
    LlmCompletionResult,
} from "~application/verification/summary/index.js";
import { AnthropicLlmClient } from "./anthropic.llm.client.js";
import { EchoLlmClient } from "./echo.llm.client.js";

const DEFAULT_SUMMARY_MODEL = "claude-haiku-4-5-20251001";

interface ResolvedClientConfig {
    readonly provider: "anthropic" | "echo";
    readonly model: string;
    readonly apiKey: string | undefined;
}

function resolveConfig(
    config: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
): ResolvedClientConfig {
    const provider = config["summary.provider"] === "anthropic" ? "anthropic" : "echo";
    const modelValue = typeof config["summary.model"] === "string"
        ? config["summary.model"].trim()
        : "";
    return {
        provider,
        model: modelValue || DEFAULT_SUMMARY_MODEL,
        apiKey: provider === "anthropic" ? env["ANTHROPIC_API_KEY"] : undefined,
    };
}

export function createLlmClient(
    config: Record<string, unknown>,
    env: NodeJS.ProcessEnv = process.env,
): ILlmClient {
    const resolved = resolveConfig(config, env);
    if (resolved.provider === "anthropic" && resolved.apiKey) {
        return new AnthropicLlmClient({ apiKey: resolved.apiKey, model: resolved.model });
    }
    return new EchoLlmClient();
}

// Caches the resolved client by config signature so we don't instantiate a
// fresh AnthropicLlmClient on every summary request. The signature includes
// the API key so a key rotation triggers a rebuild without process restart.
export class ConfigBackedLlmClient implements ILlmClient {
    private cached: { signature: string; client: ILlmClient } | null = null;

    constructor(
        private readonly config: IAppConfigRepository,
        private readonly env: NodeJS.ProcessEnv = process.env,
    ) {}

    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
        const resolved = resolveConfig(await this.config.getAll(), this.env);
        const signature = `${resolved.provider}|${resolved.model}|${resolved.apiKey ?? ""}`;
        if (!this.cached || this.cached.signature !== signature) {
            const client = resolved.provider === "anthropic" && resolved.apiKey
                ? new AnthropicLlmClient({ apiKey: resolved.apiKey, model: resolved.model })
                : new EchoLlmClient();
            this.cached = { signature, client };
        }
        return this.cached.client.complete(request);
    }
}
