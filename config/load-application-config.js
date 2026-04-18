import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLICATION_YAML_PATH = path.join(CONFIG_ROOT, "application.yaml");
const APPLICATION_LOCAL_YAML_PATH = path.join(CONFIG_ROOT, "application.local.yaml");

const DEFAULT_APPLICATION_CONFIG = Object.freeze({
  monitor: {
    protocol: "http",
    listenHost: "0.0.0.0",
    publicHost: "127.0.0.1",
    port: 3847,
    databasePath: ".monitor/monitor.sqlite"
  },
  web: {
    apiBaseUrl: "",
    wsBaseUrl: ""
  },
  externalSetup: {
    monitorBaseUrl: "",
    sourceRepo: "belljun3395/agent-tracer"
  }
});

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isPlainObject(current) && isPlainObject(value)
      ? deepMerge(current, value)
      : value;
  }
  return merged;
}

function readYamlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parse(raw) ?? {};
  return isPlainObject(parsed) ? parsed : {};
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535
    ? port
    : fallback;
}

function normalizeProtocol(value, fallback = "http") {
  const normalized = trimString(value).toLowerCase();
  return normalized === "http" || normalized === "https"
    ? normalized
    : fallback;
}

function normalizeBaseUrl(value) {
  const next = trimString(value);
  return next ? next.replace(/\/+$/g, "") : "";
}

function normalizeApplicationConfig(input) {
  const merged = deepMerge(DEFAULT_APPLICATION_CONFIG, input ?? {});

  return {
    monitor: {
      protocol: normalizeProtocol(merged.monitor?.protocol, DEFAULT_APPLICATION_CONFIG.monitor.protocol),
      listenHost: trimString(merged.monitor?.listenHost) || DEFAULT_APPLICATION_CONFIG.monitor.listenHost,
      publicHost: trimString(merged.monitor?.publicHost) || DEFAULT_APPLICATION_CONFIG.monitor.publicHost,
      port: normalizePort(merged.monitor?.port, DEFAULT_APPLICATION_CONFIG.monitor.port),
      databasePath: trimString(merged.monitor?.databasePath) || DEFAULT_APPLICATION_CONFIG.monitor.databasePath
    },
    web: {
      apiBaseUrl: normalizeBaseUrl(merged.web?.apiBaseUrl),
      wsBaseUrl: normalizeBaseUrl(merged.web?.wsBaseUrl)
    },
    externalSetup: {
      monitorBaseUrl: normalizeBaseUrl(merged.externalSetup?.monitorBaseUrl),
      sourceRepo: trimString(merged.externalSetup?.sourceRepo) || DEFAULT_APPLICATION_CONFIG.externalSetup.sourceRepo
    }
  };
}

export function loadApplicationConfig(options = {}) {
  const { env = process.env } = options;
  const yamlConfig = deepMerge(
    readYamlFile(APPLICATION_YAML_PATH),
    readYamlFile(APPLICATION_LOCAL_YAML_PATH)
  );

  return normalizeApplicationConfig({
    ...yamlConfig,
    monitor: {
      ...yamlConfig.monitor,
      ...(trimString(env.MONITOR_PROTOCOL) ? { protocol: env.MONITOR_PROTOCOL } : {}),
      ...(trimString(env.MONITOR_LISTEN_HOST) ? { listenHost: env.MONITOR_LISTEN_HOST } : {}),
      ...(trimString(env.MONITOR_PUBLIC_HOST) ? { publicHost: env.MONITOR_PUBLIC_HOST } : {}),
      ...(trimString(env.MONITOR_PORT) ? { port: env.MONITOR_PORT } : {}),
      ...(trimString(env.MONITOR_DATABASE_PATH) ? { databasePath: env.MONITOR_DATABASE_PATH } : {})
    },
    web: {
      ...yamlConfig.web,
      ...(trimString(env.VITE_MONITOR_BASE_URL) ? { apiBaseUrl: env.VITE_MONITOR_BASE_URL } : {}),
      ...(trimString(env.VITE_MONITOR_WS_BASE_URL) ? { wsBaseUrl: env.VITE_MONITOR_WS_BASE_URL } : {})
    },
    externalSetup: {
      ...yamlConfig.externalSetup,
      ...(trimString(env.AGENT_TRACER_SOURCE_REPO) ? { sourceRepo: env.AGENT_TRACER_SOURCE_REPO } : {}),
      ...(trimString(env.MONITOR_BASE_URL) ? { monitorBaseUrl: env.MONITOR_BASE_URL } : {})
    }
  });
}

export function resolveMonitorProtocol(config, env = process.env) {
  return normalizeProtocol(env.MONITOR_PROTOCOL, config.monitor.protocol);
}

export function resolveMonitorListenHost(config, env = process.env) {
  return trimString(env.MONITOR_LISTEN_HOST) || config.monitor.listenHost;
}

export function resolveMonitorPublicHost(config, env = process.env) {
  return trimString(env.MONITOR_PUBLIC_HOST) || config.monitor.publicHost;
}

export function resolveMonitorPort(config, env = process.env) {
  return normalizePort(env.MONITOR_PORT, config.monitor.port);
}

export function resolveMonitorDatabasePath(config, options = {}) {
  const { cwd = process.cwd(), env = process.env } = options;
  const databasePath = trimString(env.MONITOR_DATABASE_PATH) || config.monitor.databasePath;
  return path.isAbsolute(databasePath)
    ? databasePath
    : path.resolve(cwd, databasePath);
}

function buildOrigin(protocol, host, port) {
  return `${protocol}://${host}:${port}`;
}

export function resolveMonitorHttpBaseUrl(config, env = process.env) {
  const explicit = normalizeBaseUrl(env.MONITOR_BASE_URL);
  if (explicit) {
    return explicit;
  }

  return buildOrigin(
    resolveMonitorProtocol(config, env),
    resolveMonitorPublicHost(config, env),
    resolveMonitorPort(config, env)
  );
}

export function resolveMonitorWsBaseUrl(config, env = process.env) {
  const explicit = normalizeBaseUrl(env.MONITOR_WS_BASE_URL);
  if (explicit) {
    return explicit;
  }

  const protocol = resolveMonitorProtocol(config, env) === "https" ? "wss" : "ws";
  return buildOrigin(
    protocol,
    resolveMonitorPublicHost(config, env),
    resolveMonitorPort(config, env)
  );
}

export function resolveWebApiBaseUrl(config, env = process.env) {
  return normalizeBaseUrl(env.VITE_MONITOR_BASE_URL) || config.web.apiBaseUrl;
}

export function resolveWebWsBaseUrl(config, env = process.env) {
  return normalizeBaseUrl(env.VITE_MONITOR_WS_BASE_URL) || config.web.wsBaseUrl;
}

export function resolveExternalMonitorBaseUrl(config, env = process.env) {
  return normalizeBaseUrl(env.MONITOR_BASE_URL)
    || config.externalSetup.monitorBaseUrl
    || resolveMonitorHttpBaseUrl(config, env);
}

export function resolveExternalSourceRepo(config, env = process.env) {
  return trimString(env.AGENT_TRACER_SOURCE_REPO) || config.externalSetup.sourceRepo;
}
