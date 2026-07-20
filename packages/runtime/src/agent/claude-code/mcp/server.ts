/** Claude Code가 세션마다 띄우는 stdio MCP 서버 진입점이며 대부분의 도구는 서버를 직접 호출하고 제목 갱신만 데몬 소켓을 거친다. */
import {resolveDaemonVersion} from "~runtime/daemon/lifecycle/daemon.health.js";
import {callTool, MCP_TOOLS} from "~runtime/agent/claude-code/mcp/tool.dispatch.js";
import {readJsonRpcRequests, writeJsonRpcMessage, type JsonRpcRequest} from "~runtime/agent/claude-code/mcp/rpc.js";
import {isRecord} from "~runtime/support/json.js";

const SERVER_NAME = "agent-tracer";
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

const INSTRUCTIONS =
    "This workspace's activity is observed by Agent Tracer. A menu of saved recipes (reusable "
    + "workflows distilled from past tasks in this workspace) arrives in your context on every prompt; "
    + "get_recipe fetches the full workflow for one you saw there, report_recipe_outcome feeds back "
    + "whether a recipe you used actually helped — the only signal recipe quality is judged by — "
    + "request_recipe_scan asks for this task itself to be distilled into a new recipe candidate, and "
    + "set_task_title corrects this task's crude auto-generated title once its real scope is clear. "
    + "Each tool's own description states exactly when to call it; this note is only the overall "
    + "picture.";

function protocolVersionOf(params: unknown): string {
    return isRecord(params) && typeof params["protocolVersion"] === "string"
        ? params["protocolVersion"]
        : DEFAULT_PROTOCOL_VERSION;
}

function respond(id: string | number, result: unknown): void {
    writeJsonRpcMessage(process.stdout, {jsonrpc: "2.0", id, result});
}

function respondError(id: string | number | null, code: number, message: string): void {
    writeJsonRpcMessage(process.stdout, {jsonrpc: "2.0", id, error: {code, message}});
}

function handleRequest(request: JsonRpcRequest): void {
    // id가 없으면 notification이며 응답을 기대하지 않는다(예: notifications/initialized).
    if (request.id === undefined) return;
    const id = request.id;
    switch (request.method) {
        case "initialize":
            respond(id, {
                protocolVersion: protocolVersionOf(request.params),
                capabilities: {tools: {}},
                serverInfo: {name: SERVER_NAME, version: resolveDaemonVersion()},
                instructions: INSTRUCTIONS,
            });
            return;
        case "tools/list":
            respond(id, {tools: MCP_TOOLS});
            return;
        case "tools/call": {
            const params = isRecord(request.params) ? request.params : {};
            const name = typeof params["name"] === "string" ? params["name"] : "";
            void callTool(name, params["arguments"]).then((result) => {
                respond(id, {content: [{type: "text", text: result.text}], isError: result.isError});
            });
            return;
        }
        default:
            respondError(id, -32601, `Method not found: ${request.method}`);
    }
}

readJsonRpcRequests(process.stdin, handleRequest);
process.stdin.resume();
