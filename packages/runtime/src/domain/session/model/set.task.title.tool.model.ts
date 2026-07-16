import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 조악한 초기 제목을 고치는 도구이며, 설명 문구 자체가 에이전트의 호출 판단을 좌우하는 설계물이다. */
export const SET_TASK_TITLE_TOOL: McpToolSpec = {
    name: "set_task_title",
    description:
        "Rename the current task in Agent Tracer's dashboard. A task opens with a crude placeholder "
        + "title — for a user session, the first 120 characters of the initial prompt; for a subagent, "
        + "\"Subagent: <type>\". Set a real title once you understand what the work is actually about AND "
        + "it is a meaningful, trackable task worth its own name: as the primary agent, right after the "
        + "first exchange; as a subagent, right after you grasp the delegated task you are starting. "
        + "Judge first — if the request is trivial, throwaway, or a one-off question where the placeholder "
        + "already reads fine, skip it. Give a short, specific, human-readable title (a few words to a "
        + "short sentence). This tool cannot see which session it is attached to on its own — you must pass "
        + "the sessionId given to you in the injected task-title context exactly as provided; do not invent "
        + "one, and do not call this tool if you were not given that value. Title once, promptly, and "
        + "re-title only if the scope later shifts substantially.",
    inputSchema: {
        type: "object",
        properties: {
            title: {type: "string", description: "Short, specific task title (a few words to a short sentence)."},
            sessionId: {
                type: "string",
                description: "The sessionId provided to you in the injected task-title context. "
                    + "Pass it exactly; do not invent one.",
            },
        },
        required: ["title", "sessionId"],
    },
};

export interface SetTaskTitleArgs {
    readonly title: string;
    readonly sessionId: string;
}

export function parseSetTaskTitleArgs(value: unknown): SetTaskTitleArgs | null {
    if (!isRecord(value)) return null;
    const title = value["title"];
    const sessionId = value["sessionId"];
    if (typeof title !== "string" || title.trim() === "") return null;
    if (typeof sessionId !== "string" || sessionId.trim() === "") return null;
    return {title: title.trim(), sessionId};
}
