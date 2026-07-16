/** MCP tools/list가 그대로 실어 보내는 JSON Schema 성질 하나다. */
export interface McpJsonSchemaProperty {
    readonly type: "string" | "number" | "boolean";
    readonly description?: string;
    readonly enum?: readonly string[];
}

/** MCP 도구 입력 스키마이며 object 형태만 지원한다. */
export interface McpJsonSchema {
    readonly type: "object";
    readonly properties: Record<string, McpJsonSchemaProperty>;
    readonly required?: readonly string[];
}

/** 도구 하나의 이름과 설명과 입력 스키마이며 에이전트가 언제 부를지는 description이 정한다. */
export interface McpToolSpec {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: McpJsonSchema;
}
