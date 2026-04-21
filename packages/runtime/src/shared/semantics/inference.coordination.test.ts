import { describe, expect, it } from "vitest"
import { inferAgentSemantic, inferMcpSemantic, inferSkillSemantic } from "./inference.coordination.js"

describe("inferMcpSemantic", () => {
    it("sets subtypeKey to mcp_call", () => {
        const result = inferMcpSemantic("context7", "resolve-library-id")
        expect(result.subtypeKey).toBe("mcp_call")
    })

    it("sets toolFamily to coordination and subtypeGroup to coordination", () => {
        const result = inferMcpSemantic("context7", "resolve-library-id")
        expect(result.toolFamily).toBe("coordination")
        expect(result.subtypeGroup).toBe("coordination")
    })

    it("builds entityName as {server}/{tool}", () => {
        const result = inferMcpSemantic("context7", "query-docs")
        expect(result.entityName).toBe("context7/query-docs")
    })

    it("defaults sourceTool to mcp__{server}__{tool} when not provided", () => {
        const result = inferMcpSemantic("context7", "query-docs")
        expect(result.sourceTool).toBe("mcp__context7__query-docs")
    })

    it("uses provided sourceToolName when given", () => {
        const result = inferMcpSemantic("context7", "query-docs", "custom_tool")
        expect(result.sourceTool).toBe("custom_tool")
    })

    it("sets operation to invoke and entityType to mcp", () => {
        const result = inferMcpSemantic("server", "tool")
        expect(result.operation).toBe("invoke")
        expect(result.entityType).toBe("mcp")
    })
})

describe("inferSkillSemantic", () => {
    it("sets subtypeKey to skill_use", () => {
        const result = inferSkillSemantic("tdd-workflow")
        expect(result.subtypeKey).toBe("skill_use")
    })

    it("sets toolFamily to coordination", () => {
        const result = inferSkillSemantic("tdd-workflow")
        expect(result.toolFamily).toBe("coordination")
    })

    it("attaches skillName as entityName when provided", () => {
        const result = inferSkillSemantic("code-review")
        expect(result.entityName).toBe("code-review")
    })

    it("omits entityName when skillName is undefined", () => {
        const result = inferSkillSemantic(undefined)
        expect(result.entityName).toBeUndefined()
    })

    it("defaults sourceTool to 'Skill' when not provided", () => {
        const result = inferSkillSemantic("some-skill")
        expect(result.sourceTool).toBe("Skill")
    })

    it("uses provided sourceToolName when given", () => {
        const result = inferSkillSemantic("some-skill", "CustomSkillTool")
        expect(result.sourceTool).toBe("CustomSkillTool")
    })

    it("sets operation to invoke and entityType to skill", () => {
        const result = inferSkillSemantic("some-skill")
        expect(result.operation).toBe("invoke")
        expect(result.entityType).toBe("skill")
    })
})

describe("inferAgentSemantic", () => {
    it("sets subtypeKey to delegation", () => {
        const result = inferAgentSemantic("code-reviewer")
        expect(result.subtypeKey).toBe("delegation")
    })

    it("sets toolFamily to coordination and operation to delegate", () => {
        const result = inferAgentSemantic("code-reviewer")
        expect(result.toolFamily).toBe("coordination")
        expect(result.operation).toBe("delegate")
    })

    it("sets entityType to agent", () => {
        const result = inferAgentSemantic("code-reviewer")
        expect(result.entityType).toBe("agent")
    })

    it("attaches agent name as entityName when provided", () => {
        const result = inferAgentSemantic("planner")
        expect(result.entityName).toBe("planner")
    })

    it("omits entityName when undefined", () => {
        const result = inferAgentSemantic(undefined)
        expect(result.entityName).toBeUndefined()
    })

    it("defaults sourceTool to 'Agent' when not provided", () => {
        const result = inferAgentSemantic("some-agent")
        expect(result.sourceTool).toBe("Agent")
    })

    it("uses provided sourceToolName when given", () => {
        const result = inferAgentSemantic("some-agent", "Task")
        expect(result.sourceTool).toBe("Task")
    })
})
