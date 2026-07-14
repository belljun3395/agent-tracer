import {spawn} from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {ensureAgentTracerHome, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {resolveRuntimeRoot} from "~runtime/config/runtime.root.js";
import {probeSocket, requestDaemon} from "~runtime/daemon/ipc/socket.client.js";
import {resolveDaemonAction} from "~runtime/daemon/lifecycle/daemon.version.js";
import {
    parseDaemonGuardrailResponse,
    parseDaemonHintsResponse,
    parseDaemonPreToolGuardResponse,
    parseDaemonRulesResponse,
    type DaemonGuardrailRequest,
    type DaemonHintsRequest,
    type DaemonPreToolGuardRequest,
    type DaemonRecipeInjectedRequest,
    type DaemonRulesRequest,
} from "~runtime/daemon/port/daemon.socket.port.js";
import type {PreToolDenial} from "~runtime/domain/guardrail/model/pre-tool.model.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";
import type {PreprocessingHint, PreprocessingHintsRequest} from "~runtime/domain/hint/model/hint.model.js";

const HINTS_TIMEOUT_MS = 500;
const GUARDRAIL_TIMEOUT_MS = 1000;
const REPORT_TIMEOUT_MS = 300;
const ASSISTANT_TEXT_MAX = 8_000;

// swc-node 소스 실행이므로 컴파일된 진입점이 없으면 로더를 붙여 소스를 그대로 띄운다.
const SOURCE_LOADER = "@swc-node/register/esm-register";

function daemonEntry(): {readonly executable: string; readonly args: readonly string[]} {
    const root = resolveRuntimeRoot();
    const compiled = path.join(root, "dist/daemon/main.js");
    if (fs.existsSync(compiled)) return {executable: process.execPath, args: [compiled]};
    return {
        executable: process.execPath,
        args: ["--import", SOURCE_LOADER, path.join(root, "src/daemon/main.ts")],
    };
}

function spawnDaemon(paths: AgentTracerPaths): void {
    const {executable, args} = daemonEntry();
    ensureAgentTracerHome(paths);
    let logFd: number | undefined;
    try {
        logFd = fs.openSync(paths.logPath, "a");
    } catch {
        logFd = undefined;
    }
    const child = spawn(executable, [...args], {
        detached: true,
        stdio: logFd !== undefined ? ["ignore", logFd, logFd] : "ignore",
        env: {
            ...process.env,
            AGENT_TRACER_DAEMON_CHILD: "1",
            AGENT_TRACER_DAEMON_SOCKET: paths.socketPath,
        },
    });
    child.unref();
    if (logFd === undefined) return;
    try {
        fs.closeSync(logFd);
    } catch {
        return;
    }
}

/** 훅 호출마다 데몬 생존과 버전을 확인하고 낡았으면 최신 버전으로 다시 띄운다. */
export async function ensureDaemonRunning(env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (env.AGENT_TRACER_DAEMON_CHILD === "1") return;
    if (env.AGENT_TRACER_DAEMON_AUTOSTART === "0") return;
    const paths = resolveAgentTracerPaths(env);
    if (await resolveDaemonAction(paths) === "spawn") spawnDaemon(paths);
}

export function isDaemonAlive(paths: AgentTracerPaths = resolveAgentTracerPaths()): Promise<boolean> {
    return probeSocket(paths.socketPath);
}

/** 데몬에서 전처리 힌트를 조회하고 데몬이 없으면 조용히 비운다. */
export async function queryDaemonHints(
    taskId: string,
    request: PreprocessingHintsRequest,
): Promise<readonly PreprocessingHint[]> {
    if (!taskId) return [];
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "hints", taskId, request} satisfies DaemonHintsRequest,
            HINTS_TIMEOUT_MS,
            (parsed) => parseDaemonHintsResponse(parsed)?.hints ?? [],
            [],
        );
    } catch {
        void ensureDaemonRunning();
        return [];
    }
}

/** 데몬에 레시피 주입 관측을 보고한다. */
export async function reportRecipeInjection(
    taskId: string,
    titles: readonly string[],
    injectedBytes: number,
): Promise<void> {
    if (!taskId || titles.length === 0) return;
    const paths = resolveAgentTracerPaths();
    const message: DaemonRecipeInjectedRequest = {type: "recipe-injected", taskId, titles, injectedBytes};
    try {
        await requestDaemon(paths.socketPath, message, REPORT_TIMEOUT_MS, () => true, true);
    } catch {
        return;
    }
}

/** 데몬에서 이 태스크에 발효 중인 규칙을 조회한다. */
export async function queryDaemonRules(taskId: string): Promise<readonly GuardrailRule[]> {
    if (!taskId) return [];
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "rules", taskId} satisfies DaemonRulesRequest,
            HINTS_TIMEOUT_MS,
            (parsed) => parseDaemonRulesResponse(parsed)?.rules ?? [],
            [],
        );
    } catch {
        void ensureDaemonRunning();
        return [];
    }
}

/** 데몬에서 도구 호출 사전 거부 여부를 조회한다. */
export async function queryDaemonPreToolGuard(
    taskId: string,
    sessionId: string | undefined,
    tool: string,
    command: string | undefined,
    filePath: string | undefined,
): Promise<PreToolDenial | null> {
    if (!taskId || !tool) return null;
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "guardrail-pretool",
                taskId,
                tool,
                ...(sessionId !== undefined ? {sessionId} : {}),
                ...(command !== undefined ? {command} : {}),
                ...(filePath !== undefined ? {filePath} : {}),
            } satisfies DaemonPreToolGuardRequest,
            HINTS_TIMEOUT_MS,
            (parsed) => parseDaemonPreToolGuardResponse(parsed)?.deny ?? null,
            null,
        );
    } catch {
        void ensureDaemonRunning();
        return null;
    }
}

/** 데몬에서 턴 종료 가드레일 판정을 조회한다. */
export async function queryDaemonGuardrail(
    taskId: string,
    sessionId?: string,
    candidateAssistantText?: string,
): Promise<readonly GuardrailVerdict[]> {
    if (!taskId) return [];
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {
                type: "guardrail",
                taskId,
                ...(sessionId !== undefined ? {sessionId} : {}),
                ...(candidateAssistantText
                    ? {candidateAssistantText: candidateAssistantText.slice(0, ASSISTANT_TEXT_MAX)}
                    : {}),
            } satisfies DaemonGuardrailRequest,
            GUARDRAIL_TIMEOUT_MS,
            (parsed) => parseDaemonGuardrailResponse(parsed)?.verdicts ?? [],
            [],
        );
    } catch {
        void ensureDaemonRunning();
        return [];
    }
}
