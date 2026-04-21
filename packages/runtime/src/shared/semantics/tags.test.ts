import { describe, expect, it } from "vitest"
import { buildTagsFromMetadata, withTags } from "./tags.js"

describe("buildTagsFromMetadata", () => {
    it("returns empty array for empty metadata", () => {
        const result = buildTagsFromMetadata({})
        expect(result).toEqual([])
    })

    it("generates rule: tag from ruleId", () => {
        const result = buildTagsFromMetadata({ ruleId: "no-console" })
        expect(result).toContain("rule:no-console")
    })

    it("generates status: tag from ruleStatus", () => {
        const result = buildTagsFromMetadata({ ruleStatus: "passed" })
        expect(result).toContain("status:passed")
    })

    it("generates status: tag from verificationStatus", () => {
        const result = buildTagsFromMetadata({ verificationStatus: "verified" })
        expect(result).toContain("status:verified")
    })

    it("generates severity: tag from severity", () => {
        const result = buildTagsFromMetadata({ severity: "HIGH" })
        expect(result).toContain("severity:high")
    })

    it("normalizes tag values to lowercase and replaces spaces with hyphens", () => {
        const result = buildTagsFromMetadata({ ruleId: "My Rule ID" })
        expect(result).toContain("rule:my-rule-id")
    })

    it("generates both coordination and activity: tag from activityType", () => {
        const result = buildTagsFromMetadata({ activityType: "mcp_call" })
        expect(result).toContain("coordination")
        expect(result).toContain("activity:mcp-call")
    })

    it("generates subtype: tag from subtypeKey", () => {
        const result = buildTagsFromMetadata({ subtypeKey: "read_file" })
        expect(result).toContain("subtype:read-file")
    })

    it("generates tool-family: tag from toolFamily", () => {
        const result = buildTagsFromMetadata({ toolFamily: "explore" })
        expect(result).toContain("tool-family:explore")
    })

    it("generates source-tool: tag from sourceTool", () => {
        const result = buildTagsFromMetadata({ sourceTool: "Read" })
        expect(result).toContain("source-tool:read")
    })

    it("generates async-task tag and async: tag from asyncTaskId and asyncStatus", () => {
        const result = buildTagsFromMetadata({ asyncTaskId: "task-123", asyncStatus: "running" })
        expect(result).toContain("async-task")
        expect(result).toContain("async:running")
        expect(result).toContain("status:running")
    })

    it("generates mcp: tag from mcpServer and mcp-tool: tag from mcpTool", () => {
        const result = buildTagsFromMetadata({ mcpServer: "context7", mcpTool: "query-docs" })
        expect(result).toContain("mcp:context7")
        expect(result).toContain("mcp-tool:query-docs")
    })

    it("generates todo tag from todoId and todo: state tag from todoState", () => {
        const result = buildTagsFromMetadata({ todoId: "abc123", todoState: "in_progress" })
        expect(result).toContain("todo")
        expect(result).toContain("todo:in-progress")
    })

    it("generates model: tag from modelName", () => {
        const result = buildTagsFromMetadata({ modelName: "claude-3-5-sonnet" })
        expect(result).toContain("model:claude-3-5-sonnet")
    })

    it("generates compact tag from compactEvent flag", () => {
        const result = buildTagsFromMetadata({ compactEvent: true })
        expect(result).toContain("compact")
    })

    it("does not generate compact tag when compactEvent is false", () => {
        const result = buildTagsFromMetadata({ compactEvent: false })
        expect(result).not.toContain("compact")
    })

    it("generates compact: phase tag from compactPhase", () => {
        const result = buildTagsFromMetadata({ compactPhase: "pre" })
        expect(result).toContain("compact:pre")
    })

    it("generates question tag from questionId and question: tag from questionPhase", () => {
        const result = buildTagsFromMetadata({ questionId: "q-1", questionPhase: "asked" })
        expect(result).toContain("question")
        expect(result).toContain("question:asked")
    })

    it("returns deduplicated tags (no duplicates)", () => {
        const result = buildTagsFromMetadata({ ruleStatus: "passed", verificationStatus: "passed" })
        const statusTags = result.filter((t) => t === "status:passed")
        expect(statusTags).toHaveLength(1)
    })

    it("ignores non-string metadata values for string-based fields", () => {
        const result = buildTagsFromMetadata({ ruleId: 123 as unknown as string })
        expect(result.some((t) => t.startsWith("rule:"))).toBe(false)
    })
})

describe("withTags", () => {
    it("spreads all original fields", () => {
        const meta = { subtypeKey: "read_file", sourceTool: "Read" }
        const result = withTags(meta)
        expect(result.subtypeKey).toBe("read_file")
        expect(result.sourceTool).toBe("Read")
    })

    it("appends computed tags array", () => {
        const meta = { subtypeKey: "read_file" }
        const result = withTags(meta)
        expect(result.tags).toContain("subtype:read-file")
    })

    it("does not mutate the original object", () => {
        const meta = { subtypeKey: "read_file" }
        withTags(meta)
        expect((meta as Record<string, unknown>).tags).toBeUndefined()
    })
})
