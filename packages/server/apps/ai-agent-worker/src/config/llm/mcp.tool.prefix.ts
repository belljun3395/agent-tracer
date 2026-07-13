/** Claude Agent SDK가 MCP 도구에 강제하는 정식 명칭을 프롬프트 텍스트에 반영한다. */
export function withMcpToolPrefix(
    canonicalPrompt: string,
    toolNames: readonly string[],
    serverName: string,
): string {
    let prompt = canonicalPrompt;
    for (const name of toolNames) {
        prompt = prompt.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), `mcp__${serverName}__${name}`);
    }
    return prompt;
}

export function mcpToolNames(serverName: string, toolNames: readonly string[]): readonly string[] {
    return toolNames.map((name) => `mcp__${serverName}__${name}`);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
