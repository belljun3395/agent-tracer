import { describe, expect, it } from "vitest"
import { createStableTodoId, toBoolean, toOptionalTrimmedString } from "./utils.js"

describe("toOptionalTrimmedString", () => {
    it("returns trimmed string when value is a non-empty string", () => {
        expect(toOptionalTrimmedString("  hello  ")).toBe("hello")
    })

    it("returns undefined instead of empty string", () => {
        expect(toOptionalTrimmedString("")).toBeUndefined()
        expect(toOptionalTrimmedString("   ")).toBeUndefined()
    })

    it("returns undefined for null and undefined", () => {
        expect(toOptionalTrimmedString(null)).toBeUndefined()
        expect(toOptionalTrimmedString(undefined)).toBeUndefined()
    })

    it("converts number to trimmed string", () => {
        expect(toOptionalTrimmedString(42)).toBe("42")
    })

    it("returns undefined for non-coercible values", () => {
        expect(toOptionalTrimmedString({})).toBeUndefined()
    })

    it("truncates to maxLength when specified", () => {
        const result = toOptionalTrimmedString("hello world", 5)
        expect(result).toBe("hello")
    })
})

describe("toBoolean", () => {
    it("returns boolean values as-is", () => {
        expect(toBoolean(true)).toBe(true)
        expect(toBoolean(false)).toBe(false)
    })

    it("returns false for number 0", () => {
        expect(toBoolean(0)).toBe(false)
    })

    it("returns true for non-zero numbers", () => {
        expect(toBoolean(1)).toBe(true)
        expect(toBoolean(-1)).toBe(true)
        expect(toBoolean(42)).toBe(true)
    })

    it("returns true for string 'true' (case-insensitive)", () => {
        expect(toBoolean("true")).toBe(true)
        expect(toBoolean("TRUE")).toBe(true)
        expect(toBoolean("True")).toBe(true)
    })

    it("returns true for string '1'", () => {
        expect(toBoolean("1")).toBe(true)
    })

    it("returns true for string 'yes' (case-insensitive)", () => {
        expect(toBoolean("yes")).toBe(true)
        expect(toBoolean("YES")).toBe(true)
    })

    it("returns false for string 'false'", () => {
        expect(toBoolean("false")).toBe(false)
    })

    it("returns false for string '0'", () => {
        expect(toBoolean("0")).toBe(false)
    })

    it("returns false for null and undefined", () => {
        expect(toBoolean(null)).toBe(false)
        expect(toBoolean(undefined)).toBe(false)
    })

    it("returns false for unrecognized values", () => {
        expect(toBoolean("no")).toBe(false)
        expect(toBoolean("maybe")).toBe(false)
        expect(toBoolean({})).toBe(false)
    })
})

describe("createStableTodoId", () => {
    it("returns a 16-character hex string", () => {
        const id = createStableTodoId("Implement feature X", "high")
        expect(id).toMatch(/^[0-9a-f]{16}$/)
    })

    it("produces the same ID for the same content and priority", () => {
        const id1 = createStableTodoId("Implement feature X", "high")
        const id2 = createStableTodoId("Implement feature X", "high")
        expect(id1).toBe(id2)
    })

    it("produces different IDs for different content", () => {
        const id1 = createStableTodoId("Task A", "high")
        const id2 = createStableTodoId("Task B", "high")
        expect(id1).not.toBe(id2)
    })

    it("produces different IDs for different priority", () => {
        const id1 = createStableTodoId("Task A", "high")
        const id2 = createStableTodoId("Task A", "low")
        expect(id1).not.toBe(id2)
    })
})
