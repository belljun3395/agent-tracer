import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../../../..");
const APPLICATION_YAML_PATH = path.join(REPO_ROOT, "application.yaml");
const APPLICATION_LOCAL_YAML_PATH = path.join(REPO_ROOT, "application.local.yaml");

export interface ApplicationConfig {
    readonly monitor: {
        readonly protocol: "http" | "https";
        readonly listenHost: string;
        readonly publicHost: string;
        readonly port: number;
        readonly databasePath: string;
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

const DEFAULT_APPLICATION_CONFIG: ApplicationConfig = Object.freeze({
    monitor: {
        protocol: "http" as const,
        listenHost: "0.0.0.0",
        publicHost: "127.0.0.1",
        port: 3847,
        databasePath: ".monitor/monitor.sqlite",
    },
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

function normalizeApplicationConfig(input: unknown): ApplicationConfig {
    const merged = deepMerge(DEFAULT_APPLICATION_CONFIG, input ?? {}) as Record<string, unknown>;
    const monitor = isPlainObject(merged["monitor"]) ? merged["monitor"] : {};
    const web = isPlainObject(merged["web"]) ? merged["web"] : {};
    const externalSetup = isPlainObject(merged["externalSetup"]) ? merged["externalSetup"] : {};

    return {
        monitor: {
            protocol: normalizeProtocol(monitor["protocol"], DEFAULT_APPLICATION_CONFIG.monitor.protocol),
            listenHost: trimString(monitor["listenHost"]) || DEFAULT_APPLICATION_CONFIG.monitor.listenHost,
            publicHost: trimString(monitor["publicHost"]) || DEFAULT_APPLICATION_CONFIG.monitor.publicHost,
            port: normalizePort(monitor["port"], DEFAULT_APPLICATION_CONFIG.monitor.port),
            databasePath: trimString(monitor["databasePath"]) || DEFAULT_APPLICATION_CONFIG.monitor.databasePath,
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
    const web = isPlainObject(yamlConfig["web"]) ? yamlConfig["web"] : {};
    const externalSetup = isPlainObject(yamlConfig["externalSetup"]) ? yamlConfig["externalSetup"] : {};

    return normalizeApplicationConfig({
        ...yamlConfig,
        monitor: {
            ...monitor,
            ...(trimString(env["MONITOR_PROTOCOL"]) ? { protocol: env["MONITOR_PROTOCOL"] } : {}),
            ...(trimString(env["MONITOR_LISTEN_HOST"]) ? { listenHost: env["MONITOR_LISTEN_HOST"] } : {}),
            ...(trimString(env["MONITOR_PUBLIC_HOST"]) ? { publicHost: env["MONITOR_PUBLIC_HOST"] } : {}),
            ...(trimString(env["MONITOR_PORT"]) ? { port: env["MONITOR_PORT"] } : {}),
            ...(trimString(env["MONITOR_DATABASE_PATH"]) ? { databasePath: env["MONITOR_DATABASE_PATH"] } : {}),
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

export function resolveMonitorProtocol(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): "http" | "https" {
    return normalizeProtocol(env["MONITOR_PROTOCOL"], config.monitor.protocol);
}

export function resolveMonitorListenHost(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return trimString(env["MONITOR_LISTEN_HOST"]) || config.monitor.listenHost;
}

export function resolveMonitorPublicHost(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return trimString(env["MONITOR_PUBLIC_HOST"]) || config.monitor.publicHost;
}

export function resolveMonitorPort(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): number {
    return normalizePort(env["MONITOR_PORT"], config.monitor.port);
}

export function resolveMonitorDatabasePath(config: ApplicationConfig, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
    const { cwd = process.cwd(), env = process.env } = options;
    const databasePath = trimString(env["MONITOR_DATABASE_PATH"]) || config.monitor.databasePath;
    return path.isAbsolute(databasePath) ? databasePath : path.resolve(cwd, databasePath);
}

export function resolveMonitorHttpBaseUrl(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    const explicit = normalizeBaseUrl(env["MONITOR_BASE_URL"]);
    if (explicit) return explicit;
    return `${resolveMonitorProtocol(config, env)}://${resolveMonitorPublicHost(config, env)}:${resolveMonitorPort(config, env)}`;
}

export function resolveMonitorWsBaseUrl(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    const explicit = normalizeBaseUrl(env["MONITOR_WS_BASE_URL"]);
    if (explicit) return explicit;
    const protocol = resolveMonitorProtocol(config, env) === "https" ? "wss" : "ws";
    return `${protocol}://${resolveMonitorPublicHost(config, env)}:${resolveMonitorPort(config, env)}`;
}

export function resolveExternalMonitorBaseUrl(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return normalizeBaseUrl(env["MONITOR_BASE_URL"])
        || config.externalSetup.monitorBaseUrl
        || resolveMonitorHttpBaseUrl(config, env);
}

export function resolveExternalSourceRepo(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return (typeof env["AGENT_TRACER_SOURCE_REPO"] === "string" ? env["AGENT_TRACER_SOURCE_REPO"].trim() : "")
        || config.externalSetup.sourceRepo;
}

export function resolveWebApiBaseUrl(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return normalizeBaseUrl(env["VITE_MONITOR_BASE_URL"]) || config.web.apiBaseUrl;
}

export function resolveWebWsBaseUrl(config: ApplicationConfig, env: NodeJS.ProcessEnv = process.env): string {
    return normalizeBaseUrl(env["VITE_MONITOR_WS_BASE_URL"]) || config.web.wsBaseUrl;
}
