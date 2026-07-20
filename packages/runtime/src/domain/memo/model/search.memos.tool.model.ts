import type {McpToolSpec} from "~runtime/support/mcp.tool.js";
import {isRecord} from "~runtime/support/json.js";

/** 자기 세션 태스크의 메모 쓰레드를 읽는 도구이며, query 생략 시 전체 나열임을 설명에 못박는다. */
export const SEARCH_MEMOS_TOOL: McpToolSpec = {
    name: "search_memos",
    description:
        "Read notes left on this session's task in Agent Tracer. Call this when you want to check what a "
        + "human or a prior agent run already flagged before you repeat work or make a decision. Omit "
        + "query to list every memo on that task; pass query to narrow to memos whose text matches. The "
        + "task is the one belonging to the session this tool runs in, which it identifies on its own — "
        + "you do not pass a session or task id. If you are a subagent, this reads the task of the "
        + "session that launched you, not your own subagent task.",
    inputSchema: {
        type: "object",
        properties: {
            query: {type: "string", description: "Optional text to filter memos by. Omit to list all."},
            limit: {type: "number", description: "Max memos to return (default 20)."},
        },
        required: [],
    },
};

export interface SearchMemosArgs {
    readonly query?: string;
    readonly limit?: number;
}

export function parseSearchMemosArgs(value: unknown): SearchMemosArgs | null {
    if (!isRecord(value)) return null;
    const query = value["query"];
    const limit = value["limit"];
    return {
        ...(typeof query === "string" && query.trim() !== "" ? {query} : {}),
        ...(typeof limit === "number" && Number.isFinite(limit) ? {limit} : {}),
    };
}
