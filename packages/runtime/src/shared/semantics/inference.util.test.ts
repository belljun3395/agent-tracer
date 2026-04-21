import { describe, expect, it } from "vitest"
import { buildSemanticMetadata } from "./inference.util.js"

describe("buildSemanticMetadata", () => {
    it("preserves subtypeKey", () => {
        const result = buildSemanticMetadata({ subtypeKey: "read_file" })
        expect(result.subtypeKey).toBe("read_file")
    })

    it("keeps provided subtypeLabel unchanged", () => {
        const result = buildSemanticMetadata({ subtypeKey: "read_file", subtypeLabel: "Read file" })
        expect(result.subtypeLabel).toBe("Read file")
    })

    it("generates subtypeLabel from subtypeKey when subtypeLabel is absent", () => {
        const result = buildSemanticMetadata({ subtypeKey: "read_file" })
        expect(result.subtypeLabel).toBe("Read File")
    })

    it("humanizes multi-word subtype keys correctly", () => {
        const result = buildSemanticMetadata({ subtypeKey: "run_command" })
        expect(result.subtypeLabel).toBe("Run Command")
    })

    it("humanizes single-word subtype key correctly", () => {
        const result = buildSemanticMetadata({ subtypeKey: "delegation" })
        expect(result.subtypeLabel).toBe("Delegation")
    })

    it("strips undefined optional fields from result", () => {
        const result = buildSemanticMetadata({ subtypeKey: "read_file" })
        expect(result.subtypeGroup).toBeUndefined()
        expect(result.toolFamily).toBeUndefined()
        expect(result.operation).toBeUndefined()
        expect(result.entityType).toBeUndefined()
        expect(result.entityName).toBeUndefined()
        expect(result.sourceTool).toBeUndefined()
        expect(result.importance).toBeUndefined()
    })

    it("includes optional fields when they have values", () => {
        const result = buildSemanticMetadata({
            subtypeKey: "read_file",
            subtypeGroup: "files",
            toolFamily: "explore",
            operation: "read",
            entityType: "file",
            entityName: "src/index.ts",
            sourceTool: "Read",
        })
        expect(result.subtypeGroup).toBe("files")
        expect(result.toolFamily).toBe("explore")
        expect(result.operation).toBe("read")
        expect(result.entityType).toBe("file")
        expect(result.entityName).toBe("src/index.ts")
        expect(result.sourceTool).toBe("Read")
    })

    it("returns a new object (does not mutate input)", () => {
        const input = { subtypeKey: "read_file" as const, subtypeLabel: "Read file" }
        const result = buildSemanticMetadata(input)
        expect(result).not.toBe(input)
    })
})
