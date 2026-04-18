import type { SafePostResult } from "./client.js";
export function toToolResponse(result: SafePostResult) {
    return {
        content: [
            {
                type: "text" as const,
                text: result.message
            }
        ],
        structuredContent: result
    };
}
