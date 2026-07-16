import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 에이전트가 스스로 남기는 메모 도구이며, 데몬이 활성 태스크를 추정해 붙이는 한계를 설명에 못박는다. */
export const CREATE_MEMO_TOOL: McpToolSpec = {
    name: "create_memo",
    description:
        "Leave a short note on the current task in Agent Tracer, visible to the human operator later. "
        + "Call this when you notice something worth flagging for a human but that does not belong in your "
        + "normal response — an assumption you made, a workaround you had to use, or a risk you could not "
        + "resolve yourself. Best-effort: this tool cannot see which session it is attached to, so it "
        + "attaches to whichever task in this workspace was most recently active. If several sessions or "
        + "subagents may be active at once, expect it to occasionally land on the wrong task.",
    inputSchema: {
        type: "object",
        properties: {
            body: {type: "string", description: "The note text."},
            eventId: {
                type: "string",
                description: "Optional event id to attach the note to a specific event instead of the task overall.",
            },
        },
        required: ["body"],
    },
};

export interface CreateMemoArgs {
    readonly body: string;
    readonly eventId?: string;
}

export function parseCreateMemoArgs(value: unknown): CreateMemoArgs | null {
    if (!isRecord(value)) return null;
    const body = value["body"];
    if (typeof body !== "string" || body.trim() === "") return null;
    const eventId = value["eventId"];
    return {
        body,
        ...(typeof eventId === "string" && eventId.trim() !== "" ? {eventId} : {}),
    };
}
