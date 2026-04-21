import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { deleteJsonFile, readJsonFile, writeJsonFile } from "./json-file.store.js"

function tmpFilePath(name: string): string {
    return path.join(os.tmpdir(), `json-file-store-test-${process.pid}-${name}.json`)
}

describe("readJsonFile", () => {
    const isObject = (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null && !Array.isArray(v)

    it("reads and parses a valid JSON file", () => {
        const filePath = tmpFilePath("read-valid")
        fs.writeFileSync(filePath, JSON.stringify({ key: "value" }))
        try {
            const result = readJsonFile(filePath, isObject)
            expect(result).toEqual({ key: "value" })
        } finally {
            fs.rmSync(filePath, { force: true })
        }
    })

    it("returns null when file does not exist", () => {
        const result = readJsonFile("/nonexistent/path/file.json", isObject)
        expect(result).toBeNull()
    })

    it("returns null when file contains invalid JSON", () => {
        const filePath = tmpFilePath("read-invalid-json")
        fs.writeFileSync(filePath, "not-valid-json")
        try {
            const result = readJsonFile(filePath, isObject)
            expect(result).toBeNull()
        } finally {
            fs.rmSync(filePath, { force: true })
        }
    })

    it("returns null when validation fails", () => {
        const filePath = tmpFilePath("read-validation-fail")
        fs.writeFileSync(filePath, JSON.stringify([1, 2, 3]))
        try {
            const result = readJsonFile(filePath, isObject)
            expect(result).toBeNull()
        } finally {
            fs.rmSync(filePath, { force: true })
        }
    })
})

describe("writeJsonFile", () => {
    let filePath: string

    beforeEach(() => {
        filePath = tmpFilePath("write")
    })

    afterEach(() => {
        fs.rmSync(filePath, { force: true })
    })

    it("writes JSON content to the target file", () => {
        writeJsonFile(filePath, { hello: "world" })
        const content = fs.readFileSync(filePath, "utf-8")
        expect(JSON.parse(content)).toEqual({ hello: "world" })
    })

    it("creates parent directories if they do not exist", () => {
        const nestedPath = path.join(os.tmpdir(), `json-store-nested-${process.pid}`, "sub", "data.json")
        try {
            writeJsonFile(nestedPath, { nested: true })
            const content = fs.readFileSync(nestedPath, "utf-8")
            expect(JSON.parse(content)).toEqual({ nested: true })
        } finally {
            fs.rmSync(path.dirname(path.dirname(nestedPath)), { recursive: true, force: true })
        }
    })

    it("applies JSON spacing when specified", () => {
        writeJsonFile(filePath, { a: 1 }, 2)
        const content = fs.readFileSync(filePath, "utf-8")
        expect(content).toContain("\n")
    })

    it("overwrites existing file content", () => {
        writeJsonFile(filePath, { first: true })
        writeJsonFile(filePath, { second: true })
        const content = fs.readFileSync(filePath, "utf-8")
        expect(JSON.parse(content)).toEqual({ second: true })
    })

    it("leaves no temp file behind after successful write", () => {
        writeJsonFile(filePath, { clean: true })
        const dir = path.dirname(filePath)
        const files = fs.readdirSync(dir)
        const tempFiles = files.filter((f) => f.endsWith(".tmp") && f.includes("json-file-store-test"))
        expect(tempFiles).toHaveLength(0)
    })
})

describe("deleteJsonFile", () => {
    it("deletes an existing file", () => {
        const filePath = tmpFilePath("delete-existing")
        fs.writeFileSync(filePath, "{}")
        deleteJsonFile(filePath)
        expect(fs.existsSync(filePath)).toBe(false)
    })

    it("silently succeeds when file does not exist", () => {
        expect(() => deleteJsonFile("/nonexistent/path/file.json")).not.toThrow()
    })
})
