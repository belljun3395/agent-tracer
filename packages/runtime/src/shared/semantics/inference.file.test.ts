import { describe, expect, it } from "vitest"
import { inferFileToolSemantic } from "./inference.file.js"

describe("inferFileToolSemantic", () => {
    it("always sets toolFamily to file and subtypeGroup to file_ops", () => {
        const result = inferFileToolSemantic("Edit")
        expect(result.toolFamily).toBe("file")
        expect(result.subtypeGroup).toBe("file_ops")
        expect(result.entityType).toBe("file")
    })

    describe("patch operation", () => {
        it("maps tool name containing 'patch' to apply_patch subtype", () => {
            const result = inferFileToolSemantic("ApplyPatch")
            expect(result.subtypeKey).toBe("apply_patch")
            expect(result.operation).toBe("patch")
        })
    })

    describe("delete operation", () => {
        it("maps tool name containing 'delete' to delete_file subtype", () => {
            const result = inferFileToolSemantic("DeleteFile")
            expect(result.subtypeKey).toBe("delete_file")
            expect(result.operation).toBe("delete")
        })

        it("maps tool name containing 'remove' to delete_file subtype", () => {
            const result = inferFileToolSemantic("RemoveFile")
            expect(result.subtypeKey).toBe("delete_file")
            expect(result.operation).toBe("delete")
        })
    })

    describe("rename operation", () => {
        it("maps tool name containing 'rename' to rename_file subtype", () => {
            const result = inferFileToolSemantic("RenameFile")
            expect(result.subtypeKey).toBe("rename_file")
            expect(result.operation).toBe("rename")
        })

        it("maps tool name containing 'move' to rename_file subtype", () => {
            const result = inferFileToolSemantic("MoveFile")
            expect(result.subtypeKey).toBe("rename_file")
            expect(result.operation).toBe("rename")
        })
    })

    describe("create operation", () => {
        it("maps tool name containing 'write' to create_file subtype", () => {
            const result = inferFileToolSemantic("Write")
            expect(result.subtypeKey).toBe("create_file")
            expect(result.operation).toBe("create")
        })

        it("maps tool name containing 'create' to create_file subtype", () => {
            const result = inferFileToolSemantic("CreateFile")
            expect(result.subtypeKey).toBe("create_file")
            expect(result.operation).toBe("create")
        })
    })

    describe("modify operation (default)", () => {
        it("maps 'Edit' to modify_file subtype", () => {
            const result = inferFileToolSemantic("Edit")
            expect(result.subtypeKey).toBe("modify_file")
            expect(result.operation).toBe("modify")
        })

        it("maps unknown tool name to modify_file as default", () => {
            const result = inferFileToolSemantic("SomeUnknownFileTool")
            expect(result.subtypeKey).toBe("modify_file")
        })
    })

    describe("entityName", () => {
        it("attaches entityName when provided", () => {
            const result = inferFileToolSemantic("Edit", "src/index.ts")
            expect(result.entityName).toBe("src/index.ts")
        })

        it("omits entityName when not provided", () => {
            const result = inferFileToolSemantic("Edit")
            expect(result.entityName).toBeUndefined()
        })
    })

    describe("sourceTool", () => {
        it("preserves the original tool name as sourceTool", () => {
            const result = inferFileToolSemantic("Write")
            expect(result.sourceTool).toBe("Write")
        })
    })
})
