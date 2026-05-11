import { describe, expect, it } from "vitest"
import { createMessageId, ellipsize, isRecord, toTrimmedString, truncateOutput } from "./utils.js"

describe("isRecord", () => {
    it("returns true for plain objects", () => {
        expect(isRecord({})).toBe(true)
        expect(isRecord({ a: 1 })).toBe(true)
    })

    it("returns false for null", () => {
        expect(isRecord(null)).toBe(false)
    })

    it("returns false for arrays", () => {
        expect(isRecord([])).toBe(false)
        expect(isRecord([1, 2, 3])).toBe(false)
    })

    it("returns false for primitive types", () => {
        expect(isRecord("string")).toBe(false)
        expect(isRecord(42)).toBe(false)
        expect(isRecord(true)).toBe(false)
        expect(isRecord(undefined)).toBe(false)
    })
})

describe("toTrimmedString", () => {
    it("trims whitespace from strings", () => {
        expect(toTrimmedString("  hello  ")).toBe("hello")
    })

    it("returns string value unchanged when no trimming needed", () => {
        expect(toTrimmedString("hello")).toBe("hello")
    })

    it("converts numbers to string", () => {
        expect(toTrimmedString(42)).toBe("42")
        expect(toTrimmedString(3.14)).toBe("3.14")
    })

    it("converts booleans to string", () => {
        expect(toTrimmedString(true)).toBe("true")
        expect(toTrimmedString(false)).toBe("false")
    })

    it("converts bigint to string", () => {
        expect(toTrimmedString(BigInt(9007199254740991))).toBe("9007199254740991")
    })

    it("returns empty string for null", () => {
        expect(toTrimmedString(null)).toBe("")
    })

    it("returns empty string for undefined", () => {
        expect(toTrimmedString(undefined)).toBe("")
    })

    it("returns empty string for objects", () => {
        expect(toTrimmedString({})).toBe("")
    })

    it("returns empty string for arrays", () => {
        expect(toTrimmedString([1, 2])).toBe("")
    })

    it("truncates string when maxLength is specified and string exceeds it", () => {
        expect(toTrimmedString("hello world", 5)).toBe("hello")
    })

    it("does not truncate when string is within maxLength", () => {
        expect(toTrimmedString("hello", 10)).toBe("hello")
    })

    it("does not truncate when string equals maxLength", () => {
        expect(toTrimmedString("hello", 5)).toBe("hello")
    })
})

describe("ellipsize", () => {
    it("returns value unchanged when within maxLength", () => {
        expect(ellipsize("hello", 10)).toBe("hello")
    })

    it("returns value unchanged when equal to maxLength", () => {
        expect(ellipsize("hello", 5)).toBe("hello")
    })

    it("appends ellipsis and truncates when exceeding maxLength", () => {
        expect(ellipsize("hello world", 8)).toBe("hello w…")
    })

    it("returns single character when maxLength is 1", () => {
        expect(ellipsize("hello", 1)).toBe("h")
    })

    it("returns empty string when maxLength is 0", () => {
        expect(ellipsize("hello", 0)).toBe("")
    })

    it("produces result with length equal to maxLength when truncated", () => {
        const result = ellipsize("abcdefghij", 5)
        expect(result.length).toBe(5)
    })
})

describe("truncateOutput", () => {
    it("returns the body unchanged when under the budget", () => {
        const result = truncateOutput("short text", 100, 100)
        expect(result).toEqual({ body: "short text", bytes: 10, truncated: false })
    })

    it("keeps head and tail when the body exceeds the budget", () => {
        const body = "0123456789".repeat(20)
        const result = truncateOutput(body, 5, 5)
        expect(result.truncated).toBe(true)
        expect(result.bytes).toBe(200)
        expect(result.body.startsWith("01234")).toBe(true)
        expect(result.body.endsWith("56789")).toBe(true)
        expect(result.body).toContain("190 chars omitted")
    })

    it("counts UTF-8 bytes, not characters", () => {
        const result = truncateOutput("한글", 10, 10)
        expect(result.bytes).toBe(6)
        expect(result.truncated).toBe(false)
    })
})

describe("createMessageId", () => {
    it("returns a UUID-format string", () => {
        const id = createMessageId()
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it("returns unique values on each call", () => {
        const id1 = createMessageId()
        const id2 = createMessageId()
        expect(id1).not.toBe(id2)
    })
})
