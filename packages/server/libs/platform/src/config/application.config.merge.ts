import { buildAgentGraphConfig } from "./agent.graph.config.js";
import { applicationConfigSchema, type ApplicationConfig } from "./application.config.schema.js";
import { buildColdTierConfig } from "./cold.tier.config.js";

function section(source: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = source[key];
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const raw = env[key];
    return raw ? Number(raw) : fallback;
}

/** 기본 YAML 위에 로컬 YAML과 환경변수를 적용하고 전체 설정을 검증한다. */
export function mergeApplicationConfig(
    base: Record<string, unknown>,
    local: Record<string, unknown>,
    env: NodeJS.ProcessEnv,
    hostname: string,
): ApplicationConfig {
    const merged = { ...base, ...local };
    const runtimeDb = section(merged, "runtimeDb");
    const tracerDb = section(merged, "tracerDb");
    const kafka = section(merged, "kafka");
    const opensearch = section(merged, "opensearch");
    const temporal = section(merged, "temporal");
    const runtimeApi = section(merged, "runtimeApi");
    const tracerApi = section(merged, "tracerApi");
    const projector = section(merged, "projector");
    const user = env["POSTGRES_USER"] ?? "monitor";
    const password = env["POSTGRES_PASSWORD"] ?? "monitor";
    const brokersEnv = env["KAFKA_BROKERS"];
    const brokers = brokersEnv
        ? brokersEnv.split(",").map((broker) => broker.trim()).filter(Boolean)
        : ((kafka["brokers"] as string[] | undefined) ?? ["localhost:19092"]);
    const coldTier = buildColdTierConfig(
        section(merged, "coldStore"),
        section(merged, "tiering"),
        env,
    );

    return applicationConfigSchema.parse({
        profile: (env["MONITOR_PROFILE"] as "local" | "prd" | undefined)
            ?? (merged["profile"] as "local" | "prd" | undefined)
            ?? "local",
        runtimeApi: { port: envInt(env, "RUNTIME_API_PORT", (runtimeApi["port"] as number | undefined) ?? 3901) },
        tracerApi: { port: envInt(env, "TRACER_API_PORT", (tracerApi["port"] as number | undefined) ?? 3902) },
        projector: { port: envInt(env, "PROJECTOR_PORT", (projector["port"] as number | undefined) ?? 3903) },
        listenHost: env["MONITOR_LISTEN_HOST"] ?? (merged["listenHost"] as string | undefined) ?? "127.0.0.1",
        runtimeDb: {
            host: env["RUNTIME_DB_HOST"] ?? (runtimeDb["host"] as string | undefined) ?? "127.0.0.1",
            port: envInt(env, "RUNTIME_DB_PORT", (runtimeDb["port"] as number | undefined) ?? 5432),
            username: user,
            password,
            database: (runtimeDb["database"] as string | undefined) ?? "runtime",
        },
        tracerDb: {
            host: env["TRACER_DB_HOST"] ?? (tracerDb["host"] as string | undefined) ?? "127.0.0.1",
            port: envInt(env, "TRACER_DB_PORT", (tracerDb["port"] as number | undefined) ?? 5433),
            username: user,
            password,
            database: (tracerDb["database"] as string | undefined) ?? "tracer",
        },
        kafka: { brokers },
        opensearch: {
            node: env["OPENSEARCH_NODE"] ?? (opensearch["node"] as string | undefined) ?? "http://localhost:9200",
        },
        temporal: {
            address: env["TEMPORAL_ADDRESS"] ?? (temporal["address"] as string | undefined) ?? "localhost:7233",
            namespace: env["TEMPORAL_NAMESPACE"] ?? (temporal["namespace"] as string | undefined) ?? "default",
        },
        agentGraph: buildAgentGraphConfig(section(merged, "agentGraph"), env, hostname),
        ...coldTier,
    });
}
