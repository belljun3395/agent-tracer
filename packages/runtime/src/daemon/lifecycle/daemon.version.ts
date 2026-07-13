import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {probeSocket, requestDaemon} from "~runtime/daemon/ipc/socket.client.js";
import {readDaemonPid} from "~runtime/daemon/lifecycle/daemon.pid.js";
import {resolveDaemonVersion, UNKNOWN_DAEMON_VERSION} from "~runtime/daemon/lifecycle/daemon.health.js";
import {
    isDaemonAckResponse,
    parseDaemonVersionResponse,
    type DaemonShutdownRequest,
    type DaemonVersionRequest,
    type DaemonVersionResponse,
} from "~runtime/daemon/port/daemon.socket.port.js";

const VERSION_CHECK_TIMEOUT_MS = 200;
const SHUTDOWN_ACK_TIMEOUT_MS = 1500;
const SOCKET_FREE_TIMEOUT_MS = 2000;
const SOCKET_FREE_POLL_MS = 50;

/** 훅이 자기보다 낮은 버전의 데몬을 만나면 내리고 최신 버전으로 다시 띄운다. */
export type DaemonAction = "spawn" | "keep";

export function isDaemonOutdated(hookVersion: string, daemonVersion: string): boolean {
    const hook = parseVersion(hookVersion);
    if (hook === null) return false;
    const daemon = parseVersion(daemonVersion);
    if (daemon === null) return true;
    const length = Math.max(hook.length, daemon.length);
    for (let index = 0; index < length; index += 1) {
        const left = hook[index] ?? 0;
        const right = daemon[index] ?? 0;
        if (left !== right) return left > right;
    }
    return false;
}

export async function resolveDaemonAction(
    paths: AgentTracerPaths,
    hookVersion: string = resolveDaemonVersion(),
): Promise<DaemonAction> {
    if (!(await probeSocket(paths.socketPath))) return "spawn";
    if (hookVersion === UNKNOWN_DAEMON_VERSION) return "keep";

    let remote: DaemonVersionResponse;
    try {
        remote = await requestVersion(paths.socketPath, hookVersion);
    } catch {
        return "keep";
    }
    if (!isDaemonOutdated(hookVersion, remote.version)) return "keep";

    await shutdownDaemon(paths, remote.pid, `hook=${hookVersion} daemon=${remote.version}`);
    await waitUntilSocketFree(paths.socketPath);
    return "spawn";
}

function parseVersion(version: string): number[] | null {
    const core = version.trim().split(/[-+]/)[0] ?? "";
    const parts = core.split(".");
    if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return null;
    return parts.map((part) => Number.parseInt(part, 10));
}

function requestVersion(socketPath: string, hookVersion: string): Promise<DaemonVersionResponse> {
    return requestDaemon(
        socketPath,
        {type: "version", hookVersion} satisfies DaemonVersionRequest,
        VERSION_CHECK_TIMEOUT_MS,
        (parsed) => parseDaemonVersionResponse(parsed) ?? {version: UNKNOWN_DAEMON_VERSION},
        {version: UNKNOWN_DAEMON_VERSION},
    );
}

async function shutdownDaemon(
    paths: AgentTracerPaths,
    pid: number | undefined,
    reason: string,
): Promise<void> {
    if (await requestShutdownAck(paths.socketPath, reason)) return;
    const target = pid ?? readDaemonPid(paths);
    if (target === undefined) return;
    try {
        process.kill(target, "SIGTERM");
    } catch {
        return;
    }
}

async function requestShutdownAck(socketPath: string, reason: string): Promise<boolean> {
    try {
        return await requestDaemon(
            socketPath,
            {type: "shutdown", reason} satisfies DaemonShutdownRequest,
            SHUTDOWN_ACK_TIMEOUT_MS,
            isDaemonAckResponse,
            false,
        );
    } catch {
        return false;
    }
}

async function waitUntilSocketFree(socketPath: string, timeoutMs = SOCKET_FREE_TIMEOUT_MS): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!(await probeSocket(socketPath, 100))) return;
        await new Promise((resolve) => setTimeout(resolve, SOCKET_FREE_POLL_MS));
    }
}
