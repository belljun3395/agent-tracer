import * as fs from "node:fs";
import {DEFAULT_USER_ID, MONITOR_USER_HEADER} from "@monitor/kernel/user/user.header.const.js";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {isRecord} from "~runtime/support/json.js";

const DEFAULT_PORT = 3847;
const DEFAULT_HOST = "127.0.0.1";

/** 값 하나를 어디서 읽었는지이며, 훅과 데몬이 갈라졌을 때 어느 쪽을 고칠지 알려준다. */
export type IdentityOrigin = "env" | "file" | "default";

/** 훅과 데몬이 서버를 부를 때 쓰는 신원과 주소이며 두 프로세스가 같은 값을 읽어야 한다. */
export interface MonitorIdentity {
    readonly userId: string;
    readonly baseUrl: string;
    readonly userIdOrigin: IdentityOrigin;
    readonly baseUrlOrigin: IdentityOrigin;
}

/** 홈의 설정 파일이며 없거나 깨져 있으면 없는 것으로 친다. */
export interface MonitorConfigFile {
    readonly userId?: string;
    readonly baseUrl?: string;
}

export function readMonitorConfigFile(
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): MonitorConfigFile {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(paths.configPath, "utf8"));
        if (!isRecord(parsed)) return {};
        const userId = trimmed(parsed["userId"]);
        const baseUrl = trimmed(parsed["baseUrl"]);
        return {...(userId ? {userId} : {}), ...(baseUrl ? {baseUrl} : {})};
    } catch {
        return {};
    }
}

export function writeMonitorConfigFile(
    config: MonitorConfigFile,
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): void {
    fs.writeFileSync(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, {mode: 0o600});
}

function trimmed(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const next = value.trim();
    return next.length > 0 ? next : undefined;
}

function envBaseUrl(env: NodeJS.ProcessEnv): string | undefined {
    const explicit = trimmed(env.MONITOR_BASE_URL);
    if (explicit) return explicit;
    const port = trimmed(env.MONITOR_PORT);
    const host = trimmed(env.MONITOR_PUBLIC_HOST);
    if (!port && !host) return undefined;
    return `http://${host ?? DEFAULT_HOST}:${parseInt(port ?? "", 10) || DEFAULT_PORT}`;
}

function normalizeBaseUrl(value: string): string {
    return value.replace(/\/$/, "");
}

/** 환경변수가 파일을 이기고, 파일이 기본값을 이긴다. */
export function resolveMonitorIdentity(
    env: NodeJS.ProcessEnv = process.env,
    config: MonitorConfigFile = readMonitorConfigFile(),
): MonitorIdentity {
    const envUser = trimmed(env.MONITOR_USER_EMAIL);
    const fromEnv = envBaseUrl(env);
    const userId = envUser ?? config.userId ?? DEFAULT_USER_ID;
    const baseUrl = fromEnv ?? config.baseUrl ?? `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
    return {
        userId,
        baseUrl: normalizeBaseUrl(baseUrl),
        userIdOrigin: envUser ? "env" : config.userId ? "file" : "default",
        baseUrlOrigin: fromEnv ? "env" : config.baseUrl ? "file" : "default",
    };
}

/** 서버는 헤더가 없으면 기본 사용자로 떨어뜨리므로 기본 신원일 때는 헤더를 보내지 않는다. */
export function monitorUserHeaders(identity: MonitorIdentity): Record<string, string> {
    return identity.userId === DEFAULT_USER_ID ? {} : {[MONITOR_USER_HEADER]: identity.userId};
}
