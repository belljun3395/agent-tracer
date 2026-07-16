import {readAgentTracerConfig} from "~runtime/config/config.store.js";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {isRecord} from "~runtime/support/json.js";

/** 화면에서 조정 가능한 운영 튜닝 노브 9개이며 정합성 민감한 내부값은 여기 없다. */
export interface DaemonSettings {
    readonly recipeRefreshMs: number;
    readonly rulesRefreshMs: number;
    readonly ruleGenPollMs: number;
    readonly idleShutdownMs: number;
    readonly idleCheckMs: number;
    readonly controlRebindRetryMs: number;
    readonly controlPort: number;
    readonly spoolMaxBytes: number;
    readonly poisonAttempts: number;
}

export const DEFAULT_DAEMON_SETTINGS: DaemonSettings = {
    recipeRefreshMs: 5 * 60 * 1000,
    rulesRefreshMs: 10 * 1000,
    ruleGenPollMs: 10 * 1000,
    idleShutdownMs: 5 * 60 * 1000,
    idleCheckMs: 30 * 1000,
    controlRebindRetryMs: 2000,
    controlPort: 3848,
    spoolMaxBytes: 50 * 1024 * 1024,
    poisonAttempts: 3,
};

interface RangeSpec {
    readonly min: number;
    readonly max: number;
}

/** 폼과 방어적 읽기가 함께 쓰는 필드별 허용 범위다. */
const DAEMON_SETTINGS_RANGE: Record<keyof DaemonSettings, RangeSpec> = {
    recipeRefreshMs: {min: 10_000, max: 3_600_000},
    rulesRefreshMs: {min: 1_000, max: 600_000},
    ruleGenPollMs: {min: 1_000, max: 600_000},
    idleShutdownMs: {min: 10_000, max: 3_600_000},
    idleCheckMs: {min: 1_000, max: 600_000},
    controlRebindRetryMs: {min: 100, max: 60_000},
    controlPort: {min: 1, max: 65_535},
    spoolMaxBytes: {min: 1_048_576, max: 1_073_741_824},
    poisonAttempts: {min: 1, max: 20},
};

const FIELDS = Object.keys(DEFAULT_DAEMON_SETTINGS) as (keyof DaemonSettings)[];

function inRange(field: keyof DaemonSettings, value: number): boolean {
    const range = DAEMON_SETTINGS_RANGE[field];
    return Number.isInteger(value) && value >= range.min && value <= range.max;
}

function toNumber(value: unknown): number {
    return typeof value === "number" ? value : Number(value);
}

function envControlPort(env: NodeJS.ProcessEnv): number | undefined {
    const parsed = Number(env.AGENT_TRACER_RESUME_PORT);
    return inRange("controlPort", parsed) ? parsed : undefined;
}

/** 파일 값이 범위 밖이거나 없으면 조용히 기본값으로 떨어지고 `controlPort`만 env가 파일을 이긴다. */
export function resolveDaemonSettings(
    env: NodeJS.ProcessEnv = process.env,
    paths: AgentTracerPaths = resolveAgentTracerPaths(),
): DaemonSettings {
    const record = readAgentTracerConfig(paths);
    const daemon = isRecord(record["daemon"]) ? record["daemon"] : {};
    const resolved = {} as Record<keyof DaemonSettings, number>;
    for (const field of FIELDS) {
        const candidate = toNumber(daemon[field]);
        resolved[field] = inRange(field, candidate) ? candidate : DEFAULT_DAEMON_SETTINGS[field];
    }
    resolved.controlPort = envControlPort(env) ?? resolved.controlPort;
    return resolved;
}

export type DaemonSettingsValidation =
    | {readonly ok: true; readonly value: DaemonSettings}
    | {readonly ok: false; readonly errors: Record<string, string>};

/** 쓰기 경로가 쓰는 순수 검증이며 클램프하지 않고 범위 밖 필드마다 메시지를 낸다. */
export function validateDaemonSettingsInput(raw: unknown): DaemonSettingsValidation {
    const record = isRecord(raw) ? raw : {};
    const errors: Record<string, string> = {};
    const value = {} as Record<keyof DaemonSettings, number>;
    for (const field of FIELDS) {
        const range = DAEMON_SETTINGS_RANGE[field];
        const candidate = toNumber(record[field]);
        if (!inRange(field, candidate)) {
            errors[field] = `${field} must be an integer between ${range.min} and ${range.max}`;
            continue;
        }
        value[field] = candidate;
    }
    if (Object.keys(errors).length > 0) return {ok: false, errors};
    return {ok: true, value};
}
