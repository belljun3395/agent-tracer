import { describe, expect, it } from "vitest"
import {
    getAgentContext,
    getSessionId,
    getToolInput,
    getToolName,
    getToolUseId,
    parseMcpToolName,
    stringifyToolInput,
} from "./payload.js"

describe("getToolInput", () => {
    it("returns the tool_input object when present and is a plain object", () => {
        const event = { tool_input: { file_path: "src/index.ts" } }
        expect(getToolInput(event)).toEqual({ file_path: "src/index.ts" })
    })

    it("returns empty object when tool_input is absent", () => {
        expect(getToolInput({})).toEqual({})
    })

    it("returns empty object when tool_input is not a plain object", () => {
        expect(getToolInput({ tool_input: "string" })).toEqual({})
        expect(getToolInput({ tool_input: null })).toEqual({})
        expect(getToolInput({ tool_input: [1, 2] })).toEqual({})
    })
})

describe("getSessionId", () => {
    it("returns session_id as trimmed string for standard hook", () => {
        const event = { session_id: "  abc-123  " }
        expect(getSessionId(event)).toBe("abc-123")
    })

    it("returns session_id when hook_source is 'claude-hook'", () => {
        const event = { session_id: "abc-123", hook_source: "claude-hook" }
        expect(getSessionId(event)).toBe("abc-123")
    })

    it("returns empty string when hook_source is a non-claude value", () => {
        const event = { session_id: "abc-123", hook_source: "other-source" }
        expect(getSessionId(event)).toBe("")
    })

    it("returns empty string when session_id is absent", () => {
        expect(getSessionId({})).toBe("")
    })
})

describe("getToolName", () => {
    it("returns trimmed tool_name", () => {
        const event = { tool_name: "  Read  " }
        expect(getToolName(event)).toBe("Read")
    })

    it("returns empty string when tool_name is absent", () => {
        expect(getToolName({})).toBe("")
    })
})

describe("getToolUseId", () => {
    it("returns tool_use_id when present", () => {
        const event = { tool_use_id: "tu-abc123" }
        expect(getToolUseId(event)).toBe("tu-abc123")
    })

    it("returns undefined when tool_use_id is absent", () => {
        expect(getToolUseId({})).toBeUndefined()
    })

    it("returns undefined when tool_use_id is empty string", () => {
        expect(getToolUseId({ tool_use_id: "" })).toBeUndefined()
    })

    it("returns undefined when tool_use_id is whitespace only", () => {
        expect(getToolUseId({ tool_use_id: "   " })).toBeUndefined()
    })
})

describe("getAgentContext", () => {
    it("returns agentId and agentType when both are present", () => {
        const event = { agent_id: "agent-1", agent_type: "background" }
        const result = getAgentContext(event)
        expect(result).toEqual({ agentId: "agent-1", agentType: "background" })
    })

    it("omits agentId when absent", () => {
        const event = { agent_type: "background" }
        const result = getAgentContext(event)
        expect(result.agentId).toBeUndefined()
        expect(result.agentType).toBe("background")
    })

    it("omits agentType when absent", () => {
        const event = { agent_id: "agent-1" }
        const result = getAgentContext(event)
        expect(result.agentId).toBe("agent-1")
        expect(result.agentType).toBeUndefined()
    })

    it("returns empty object when both are absent", () => {
        expect(getAgentContext({})).toEqual({})
    })

    it("omits fields when values are empty strings", () => {
        const event = { agent_id: "", agent_type: "" }
        expect(getAgentContext(event)).toEqual({})
    })
})

describe("parseMcpToolName", () => {
    it("parses valid mcp__ prefixed tool name", () => {
        const result = parseMcpToolName("mcp__context7__query-docs")
        expect(result).toEqual({ server: "context7", tool: "query-docs" })
    })

    it("joins remaining segments with __ when tool name contains __", () => {
        const result = parseMcpToolName("mcp__server__tool__with__underscores")
        expect(result).toEqual({ server: "server", tool: "tool__with__underscores" })
    })

    it("returns null for non-mcp tool names", () => {
        expect(parseMcpToolName("Read")).toBeNull()
        expect(parseMcpToolName("Bash")).toBeNull()
    })

    it("returns null when only mcp__ prefix with no parts", () => {
        expect(parseMcpToolName("mcp__")).toBeNull()
    })

    it("returns null when missing tool part", () => {
        expect(parseMcpToolName("mcp__server__")).toBeNull()
    })

    it("returns null when missing server part", () => {
        expect(parseMcpToolName("mcp____tool")).toBeNull()
    })

    it("returns null for empty string", () => {
        expect(parseMcpToolName("")).toBeNull()
    })
})

describe("stringifyToolInput", () => {
    it("returns a shallow copy of the input object", () => {
        const input = { key: "value" }
        const result = stringifyToolInput(input)
        expect(result).not.toBe(input)
        expect(result).toEqual({ key: "value" })
    })

    it("truncates string values exceeding maxValueLength", () => {
        const input = { content: "a".repeat(20) }
        const result = stringifyToolInput(input, 10)
        expect((result.content as string).length).toBe(10)
    })

    it("preserves numbers and booleans", () => {
        const input = { count: 42, flag: true }
        const result = stringifyToolInput(input)
        expect(result.count).toBe(42)
        expect(result.flag).toBe(true)
    })

    it("converts bigint to string", () => {
        const input = { big: BigInt(9007199254740991) }
        const result = stringifyToolInput(input)
        expect(result.big).toBe("9007199254740991")
    })

    it("recursively sanitizes nested objects", () => {
        const input = { nested: { deep: "value" } }
        const result = stringifyToolInput(input)
        expect((result.nested as Record<string, unknown>).deep).toBe("value")
    })

    it("recursively sanitizes arrays", () => {
        const input = { items: ["a", "b", "c"] }
        const result = stringifyToolInput(input)
        expect(result.items).toEqual(["a", "b", "c"])
    })

    it("replaces nested objects at depth 4 with [max-depth]", () => {
        // depth check fires after primitive checks, so only objects/arrays get replaced
        // a(0) → b(1) → c(2) → d(3) → e is an object at depth 4 → "[max-depth]"
        const input = { a: { b: { c: { d: { e: { f: "value" } } } } } }
        const result = stringifyToolInput(input)
        const e = ((((result.a as Record<string, unknown>).b as Record<string, unknown>).c as Record<string, unknown>).d as Record<string, unknown>).e
        expect(e).toBe("[max-depth]")
    })

    it("preserves null values", () => {
        const input = { nullField: null }
        const result = stringifyToolInput(input)
        expect(result.nullField).toBeNull()
    })
})
