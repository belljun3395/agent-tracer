import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../../../..");
const APPLICATION_YAML_PATH = path.join(REPO_ROOT, "application.yaml");
const APPLICATION_LOCAL_YAML_PATH = path.join(REPO_ROOT, "application.local.yaml");

export type AppProfile = "local" | "prd";

export interface ApplicationConfig {
    readonly profile: AppProfile;
    readonly monitor: {
        readonly protocol: "http" | "https";
        readonly listenHost: string;
        readonly publicHost: string;
        readonly port: number;
    };
    readonly postgres: {
        readonly host: string;
        readonly port: number;
        readonly username: string;
        readonly password: string;
        readonly database: string;
    };
    readonly redis: {
        readonly url: string;
    };
    readonly web: {
        readonly apiBaseUrl: string;
        readonly wsBaseUrl: string;
    };
    readonly externalSetup: {
        readonly monitorBaseUrl: string;
        readonly sourceRepo: string;
    };
}

export const applicationConfigSchema = z.object({
    profile: z.enum(["local", "prd"]),
    monitor: z.object({
        protocol: z.enum(["http", "https"]),
        listenHost: z.string().min(1),
        publicHost: z.string().min(1),
        port: z.number().int().positive().max(65535),
    }),
    postgres: z.object({
        host: z.string().min(1),
        port: z.number().int().positive().max(65535),
        username: z.string().min(1),
        password: z.string(),
        database: z.string().min(1),
    }),
    redis: z.object({
        url: z.string().min(1),
    }),
    web: z.object({
        apiBaseUrl: z.string(),
        wsBaseUrl: z.string(),
    }),
    externalSetup: z.object({
        monitorBaseUrl: z.string(),
        sourceRepo: z.string().min(1),
    }),
});

const DEFAULT_APPLICATION_CONFIG: ApplicationConfig = Object.freeze({
    profile: "local" as const,
    monitor: {
        protocol: "http" as const,
        listenHost: "127.0.0.1",
        publicHost: "127.0.0.1",
        port: 3847,
    },
    postgres: {
        host: "127.0.0.1",
        port: 5432,
        username: "monitor",
        password: "monitor",
        database: "monitor",
    },
    redis: { url: "redis://127.0.0.1:6379" },
    web: { apiBaseUrl: "", wsBaseUrl: "" },
    externalSetup: {
        monitorBaseUrl: "",
        sourceRepo: "belljun3395/agent-tracer",
    },
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, override: unknown): unknown {
    if (!isPlainObject(base) || !isPlainObject(override)) return override;
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
        merged[key] =
            isPlainObject(merged[key]) && isPlainObject(value)
                ? deepMerge(merged[key], value)
                : value;
    }
    return merged;
}

function readYamlFile(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parse(raw) as unknown;
    return isPlainObject(parsed) ? parsed : {};
}

function trimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizePort(value: unknown, fallback: number): number {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function normalizeProtocol(
    value: unknown,
    fallback: "http" | "https" = "http",
): "http" | "https" {
    const normalized = trimString(value).toLowerCase();
    return normalized === "http" || normalized === "https" ? normalized : fallback;
}

function normalizeBaseUrl(value: unknown): string {
    const normalized = trimString(value);
    return normalized ? normalized.replace(/\/+$/g, "") : "";
}

function normalizeProfile(value: unknown, fallback: AppProfile = "local"): AppProfile {
    const normalized = trimString(value).toLowerCase();
    return normalized === "local" || normalized === "prd" ? normalized : fallback;
}

function normalizeApplicationConfig(input: unknown): ApplicationConfig {
    const merged = deepMerge(DEFAULT_APPLICATION_CONFIG, input ?? {}) as Record<string, unknown>;
    const monitor = isPlainObject(merged["monitor"]) ? merged["monitor"] : {};
    const postgres = isPlainObject(merged["postgres"]) ? merged["postgres"] : {};
    const redis = isPlainObject(merged["redis"]) ? merged["redis"] : {};
    const web = isPlainObject(merged["web"]) ? merged["web"] : {};
    const externalSetup = isPlainObject(merged["externalSetup"]) ? merged["externalSetup"] : {};
    const defaults = DEFAULT_APPLICATION_CONFIG;

    return {
        profile: normalizeProfile(merged["profile"], defaults.profile),
        monitor: {
            protocol: normalizeProtocol(monitor["protocol"], DEFAULT_APPLICATION_CONFIG.monitor.protocol),
            listenHost: trimString(monitor["listenHost"]) || DEFAULT_APPLICATION_CONFIG.monitor.listenHost,
            publicHost: trimString(monitor["publicHost"]) || DEFAULT_APPLICATION_CONFIG.monitor.publicHost,
            port: normalizePort(monitor["port"], DEFAULT_APPLICATION_CONFIG.monitor.port),
        },
        postgres: {
            host: trimString(postgres["host"]) || defaults.postgres.host,
            port: normalizePort(postgres["port"], defaults.postgres.port),
            username: trimString(postgres["username"]) || defaults.postgres.username,
            password: typeof postgres["password"] === "string" ? postgres["password"] : defaults.postgres.password,
            database: trimString(postgres["database"]) || defaults.postgres.database,
        },
        redis: {
            url: trimString(redis["url"]) || defaults.redis.url,
        },
        web: {
            apiBaseUrl: normalizeBaseUrl(web["apiBaseUrl"]),
            wsBaseUrl: normalizeBaseUrl(web["wsBaseUrl"]),
        },
        externalSetup: {
            monitorBaseUrl: normalizeBaseUrl(externalSetup["monitorBaseUrl"]),
            sourceRepo: trimString(externalSetup["sourceRepo"]) || DEFAULT_APPLICATION_CONFIG.externalSetup.sourceRepo,
        },
    };
}

export function loadApplicationConfig(options: { env?: NodeJS.ProcessEnv } = {}): ApplicationConfig {
    const { env = process.env } = options;
    const yamlConfig = deepMerge(
        readYamlFile(APPLICATION_YAML_PATH),
        readYamlFile(APPLICATION_LOCAL_YAML_PATH),
    ) as Record<string, unknown>;
    const monitor = isPlainObject(yamlConfig["monitor"]) ? yamlConfig["monitor"] : {};
    const postgres = isPlainObject(yamlConfig["postgres"]) ? yamlConfig["postgres"] : {};
    const redis = isPlainObject(yamlConfig["redis"]) ? yamlConfig["redis"] : {};
    const web = isPlainObject(yamlConfig["web"]) ? yamlConfig["web"] : {};
    const externalSetup = isPlainObject(yamlConfig["externalSetup"]) ? yamlConfig["externalSetup"] : {};

    return normalizeApplicationConfig({
        ...yamlConfig,
        ...(trimString(env["MONITOR_PROFILE"]) ? { profile: env["MONITOR_PROFILE"] } : {}),
        monitor: {
            ...monitor,
            ...(trimString(env["MONITOR_PROTOCOL"]) ? { protocol: env["MONITOR_PROTOCOL"] } : {}),
            ...(trimString(env["MONITOR_LISTEN_HOST"]) ? { listenHost: env["MONITOR_LISTEN_HOST"] } : {}),
            ...(trimString(env["MONITOR_PUBLIC_HOST"]) ? { publicHost: env["MONITOR_PUBLIC_HOST"] } : {}),
            ...(trimString(env["MONITOR_PORT"]) ? { port: env["MONITOR_PORT"] } : {}),
        },
        postgres: {
            ...postgres,
            ...(trimString(env["POSTGRES_HOST"]) ? { host: env["POSTGRES_HOST"] } : {}),
            ...(trimString(env["POSTGRES_PORT"]) ? { port: env["POSTGRES_PORT"] } : {}),
            ...(trimString(env["POSTGRES_USER"]) ? { username: env["POSTGRES_USER"] } : {}),
            ...(env["POSTGRES_PASSWORD"] !== undefined ? { password: env["POSTGRES_PASSWORD"] } : {}),
            ...(trimString(env["POSTGRES_DB"]) ? { database: env["POSTGRES_DB"] } : {}),
        },
        redis: {
            ...redis,
            ...(trimString(env["REDIS_URL"]) ? { url: env["REDIS_URL"] } : {}),
        },
        web: {
            ...web,
            ...(trimString(env["VITE_MONITOR_BASE_URL"]) ? { apiBaseUrl: env["VITE_MONITOR_BASE_URL"] } : {}),
            ...(trimString(env["VITE_MONITOR_WS_BASE_URL"]) ? { wsBaseUrl: env["VITE_MONITOR_WS_BASE_URL"] } : {}),
        },
        externalSetup: {
            ...externalSetup,
            ...(trimString(env["AGENT_TRACER_SOURCE_REPO"]) ? { sourceRepo: env["AGENT_TRACER_SOURCE_REPO"] } : {}),
            ...(trimString(env["MONITOR_BASE_URL"]) ? { monitorBaseUrl: env["MONITOR_BASE_URL"] } : {}),
        },
    });
}

function resolveMonitorProtocol(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): "http" | "https" {
    return normalizeProtocol(env["MONITOR_PROTOCOL"], config.monitor.protocol);
}

export function resolveMonitorListenHost(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return trimString(env["MONITOR_LISTEN_HOST"]) || config.monitor.listenHost;
}

function resolveMonitorPublicHost(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return trimString(env["MONITOR_PUBLIC_HOST"]) || config.monitor.publicHost;
}

export function resolveMonitorPort(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): number {
    return normalizePort(env["MONITOR_PORT"], config.monitor.port);
}

export function resolveMonitorHttpBaseUrl(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    const explicit = normalizeBaseUrl(env["MONITOR_BASE_URL"]);
    if (explicit) return explicit;
    return `${resolveMonitorProtocol(config, env)}://${resolveMonitorPublicHost(config, env)}:${resolveMonitorPort(config, env)}`;
}
