// OTLP log attribute keys produced by the runtime telemetry reporter.
// Server reads these when ingesting token-usage logs via the /v1/logs endpoint.

export const OTLP_RESOURCE_ATTRS = {
    sessionId: "session.id",
    runtimeSource: "runtime.source",
} as const;

export const OTLP_LOG_ATTRS = {
    eventName: "event.name",
    sessionId: "session.id",
    inputTokens: "input_tokens",
    outputTokens: "output_tokens",
    cacheReadTokens: "cache_read_tokens",
    cacheCreateTokens: "cache_creation_tokens",
    costUsd: "cost_usd",
    durationMs: "duration_ms",
    model: "model",
    promptId: "prompt.id",
} as const;

export const OTLP_EVENT_NAMES = {
    apiRequest: "api_request",
} as const;

export const OTLP_FALLBACK_RUNTIME_SOURCE = "claude-plugin";
