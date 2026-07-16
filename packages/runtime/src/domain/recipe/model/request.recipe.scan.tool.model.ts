import type {McpToolSpec} from "~runtime/support/mcp.tool.js";

/** 사용자의 /recipe 발화와 같은 잡을 큐잉하는 도구이며 언제 스스로 판단해 부를지를 설명에 못박는다. */
export const REQUEST_RECIPE_SCAN_TOOL: McpToolSpec = {
    name: "request_recipe_scan",
    description:
        "Ask Agent Tracer to scan this task for reusable patterns and turn them into a recipe "
        + "candidate for later review. Call this near the end of a task, once you judge that the "
        + "approach you used — a non-obvious fix, a multi-step setup, a workaround worth remembering — "
        + "would be worth reusing the next time this kind of work comes up in this workspace. "
        + "Equivalent to the user typing /recipe. Runs in the background and does not return the "
        + "recipe itself, so don't call this expecting immediate output.",
    inputSchema: {type: "object", properties: {}},
};
