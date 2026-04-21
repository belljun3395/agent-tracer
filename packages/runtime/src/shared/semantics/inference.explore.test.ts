import { describe, expect, it } from "vitest"
import { inferExploreSemantic } from "./inference.explore.js"

describe("inferExploreSemantic", () => {
    describe("Read tool", () => {
        it("maps 'Read' to read_file subtype", () => {
            const result = inferExploreSemantic("Read")
            expect(result.subtypeKey).toBe("read_file")
            expect(result.toolFamily).toBe("explore")
            expect(result.operation).toBe("read")
            expect(result.entityType).toBe("file")
        })

        it("maps tool name containing 'view' to read_file subtype", () => {
            const result = inferExploreSemantic("ViewFile")
            expect(result.subtypeKey).toBe("read_file")
        })

        it("maps tool name containing 'open' to read_file subtype", () => {
            const result = inferExploreSemantic("OpenDocument")
            expect(result.subtypeKey).toBe("read_file")
        })

        it("attaches entityName when provided", () => {
            const result = inferExploreSemantic("Read", { entityName: "src/index.ts" })
            expect(result.entityName).toBe("src/index.ts")
        })

        it("omits entityName when not provided", () => {
            const result = inferExploreSemantic("Read")
            expect(result.entityName).toBeUndefined()
        })

        it("preserves original sourceTool name", () => {
            const result = inferExploreSemantic("Read")
            expect(result.sourceTool).toBe("Read")
        })
    })

    describe("Glob tool", () => {
        it("maps tool name containing 'glob' to glob_files subtype", () => {
            const result = inferExploreSemantic("Glob")
            expect(result.subtypeKey).toBe("glob_files")
            expect(result.subtypeGroup).toBe("search")
            expect(result.operation).toBe("search")
        })

        it("is case-insensitive for glob matching", () => {
            const result = inferExploreSemantic("GLOB_FILES")
            expect(result.subtypeKey).toBe("glob_files")
        })
    })

    describe("Grep tool", () => {
        it("maps tool name containing 'grep' to grep_code subtype", () => {
            const result = inferExploreSemantic("Grep")
            expect(result.subtypeKey).toBe("grep_code")
            expect(result.subtypeGroup).toBe("search")
        })

        it("attaches entityName from options when provided", () => {
            const result = inferExploreSemantic("Grep", { entityName: "*.ts" })
            expect(result.entityName).toBe("*.ts")
        })
    })

    describe("WebFetch tool", () => {
        it("maps tool name containing 'webfetch' to web_fetch subtype", () => {
            const result = inferExploreSemantic("WebFetch")
            expect(result.subtypeKey).toBe("web_fetch")
            expect(result.subtypeGroup).toBe("web")
            expect(result.entityType).toBe("url")
            expect(result.operation).toBe("fetch")
        })

        it("uses queryOrUrl as entityName for web_fetch", () => {
            const result = inferExploreSemantic("WebFetch", { queryOrUrl: "https://example.com" })
            expect(result.entityName).toBe("https://example.com")
        })

        it("ignores entityName option for web_fetch (uses queryOrUrl)", () => {
            const result = inferExploreSemantic("WebFetch", { entityName: "ignored", queryOrUrl: "https://example.com" })
            expect(result.entityName).toBe("https://example.com")
        })

        it("omits entityName when queryOrUrl not provided for web_fetch", () => {
            const result = inferExploreSemantic("WebFetch")
            expect(result.entityName).toBeUndefined()
        })
    })

    describe("WebSearch tool", () => {
        it("maps tool name containing 'websearch' to web_search subtype", () => {
            const result = inferExploreSemantic("WebSearch")
            expect(result.subtypeKey).toBe("web_search")
            expect(result.entityType).toBe("query")
            expect(result.operation).toBe("search")
        })

        it("uses queryOrUrl as entityName for web_search", () => {
            const result = inferExploreSemantic("WebSearch", { queryOrUrl: "typescript generics" })
            expect(result.entityName).toBe("typescript generics")
        })
    })

    describe("fallback (LS / unknown)", () => {
        it("maps LS to list_files subtype", () => {
            const result = inferExploreSemantic("LS")
            expect(result.subtypeKey).toBe("list_files")
            expect(result.operation).toBe("list")
        })

        it("maps unknown tool name to list_files as default", () => {
            const result = inferExploreSemantic("SomeUnknownTool")
            expect(result.subtypeKey).toBe("list_files")
        })

        it("attaches entityName in fallback when provided", () => {
            const result = inferExploreSemantic("LS", { entityName: "src/" })
            expect(result.entityName).toBe("src/")
        })
    })
})
