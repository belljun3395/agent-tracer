import {resolveClaudeSessionId} from "~runtime/config/env.js";
import {resolveAgentTracerPaths} from "~runtime/config/home.paths.js";
import {requestDaemon} from "~runtime/daemon/ipc/socket.client.js";
import {
    parseDaemonSetTaskTitleResponse,
    type DaemonSetTaskTitleRequest,
    type DaemonSetTaskTitleResponse,
} from "~runtime/daemon/port/mcp.socket.port.js";

const REQUEST_TIMEOUT_MS = 3000;
const NO_DAEMON_TITLE: DaemonSetTaskTitleResponse = {ok: false, reason: "daemon_unreachable"};
const UNKNOWN_SESSION = "unknown_session";

/** MCP set_task_title 도구가 데몬에 재제목을 위임하며, 데몬이 sessionId로 바인딩을 찾아 taskId를 채운다. */
export async function setTaskTitleViaDaemon(title: string): Promise<DaemonSetTaskTitleResponse> {
    const sessionId = resolveClaudeSessionId();
    if (sessionId === undefined) return {ok: false, reason: UNKNOWN_SESSION};
    const paths = resolveAgentTracerPaths();
    try {
        return await requestDaemon(
            paths.socketPath,
            {type: "set-task-title", title, sessionId} satisfies DaemonSetTaskTitleRequest,
            REQUEST_TIMEOUT_MS,
            (parsed) => parseDaemonSetTaskTitleResponse(parsed) ?? NO_DAEMON_TITLE,
            NO_DAEMON_TITLE,
        );
    } catch {
        return NO_DAEMON_TITLE;
    }
}
