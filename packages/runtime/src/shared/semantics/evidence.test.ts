import { describe, expect, it } from "vitest"
import { provenEvidence } from "./evidence.js"

describe("provenEvidence", () => {
    it("returns evidenceLevel of proven", () => {
        const result = provenEvidence("tool output confirmed it")
        expect(result.evidenceLevel).toBe("proven")
    })

    it("returns the given reason string unchanged", () => {
        const reason = "assistant explicitly stated it"
        const result = provenEvidence(reason)
        expect(result.evidenceReason).toBe(reason)
    })

    it("returns an object with exactly two keys", () => {
        const result = provenEvidence("some reason")
        expect(Object.keys(result)).toHaveLength(2)
    })
})
