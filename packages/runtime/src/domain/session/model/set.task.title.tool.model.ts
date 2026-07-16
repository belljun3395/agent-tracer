import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 조악한 초기 제목을 고치는 도구이며 설명 문구가 언제 부를지와 세션 해석의 한계를 함께 못박는다. */
export const SET_TASK_TITLE_TOOL: McpToolSpec = {
    name: "set_task_title",
    description:
        "Rename the current task in Agent Tracer's dashboard. The task starts with a crude placeholder "
        + "title (the first 120 characters of the user's initial prompt). Call this once you understand "
        + "what the task is actually about and can give it a short, specific, human-readable title — "
        + "typically right after the first exchange, and again later if the scope shifts substantially. "
        + "Best-effort: this tool cannot see which chat session it is attached to, so it retitles "
        + "whichever task in this workspace was most recently active. Avoid calling it if you suspect "
        + "multiple sessions in this workspace could be active at once.",
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
