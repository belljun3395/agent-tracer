import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 조악한 초기 제목을 고치는 도구이며, 설명 문구 자체가 에이전트의 호출 판단을 좌우하는 설계물이다. */
export const SET_TASK_TITLE_TOOL: McpToolSpec = {
    name: "set_task_title",
    description:
        "Rename this session's task in Agent Tracer's dashboard. A task opens with a crude placeholder "
        + "title — the first 120 characters of the initial prompt, or \"Subagent: <type>\". Set a real "
        + "title once you understand what the work is actually about and it is worth tracking on its own. "
        + "If the request is trivial, throwaway, or a one-off question, skip it. Give a short, specific "
        + "title, and re-title only if the scope later shifts substantially. The tool identifies its own "
        + "session, so you do not pass a session or task id; a subagent renames the task of the session "
        + "that launched it.",
    inputSchema: {
        type: "object",
        properties: {
            title: {type: "string", description: "Short, specific task title (a few words to a short sentence)."},
        },
        required: ["title"],
    },
};

export interface SetTaskTitleArgs {
    readonly title: string;
}

export function parseSetTaskTitleArgs(value: unknown): SetTaskTitleArgs | null {
    if (!isRecord(value)) return null;
    const title = value["title"];
    return typeof title === "string" && title.trim() !== "" ? {title: title.trim()} : null;
}
