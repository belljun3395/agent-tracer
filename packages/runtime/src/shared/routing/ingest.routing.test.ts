import { describe, expect, it } from "vitest"
import { KIND } from "../events/kinds.const.js"
import type { RuntimeIngestEventKind } from "../events/kinds.type.js"
import { resolveIngestEndpoint, TOOL_ACTIVITY_EVENT_KINDS, WORKFLOW_EVENT_KINDS, CONVERSATION_EVENT_KINDS, COORDINATION_EVENT_KINDS, LIFECYCLE_EVENT_KINDS, TELEMETRY_EVENT_KINDS, RUNTIME_INGEST_EVENT_KINDS } from "./ingest.routing.js"

describe("resolveIngestEndpoint", () => {
    it("assigns every declared runtime event kind to a routing group", () => {
        expect(new Set(RUNTIME_INGEST_EVENT_KINDS)).toEqual(new Set(Object.values(KIND)))
    })

    it.each(TOOL_ACTIVITY_EVENT_KINDS)("routes '%s' to /ingest/v1/events/typed/tool/activity", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/events/typed/tool/activity")
    })

    it.each(WORKFLOW_EVENT_KINDS)("routes '%s' to /ingest/v1/events/typed/workflow", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/events/typed/workflow")
    })

    it.each(CONVERSATION_EVENT_KINDS)("routes '%s' to /ingest/v1/events/typed/conversation", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/events/typed/conversation")
    })

    it.each(COORDINATION_EVENT_KINDS)("routes '%s' to /ingest/v1/events/typed/coordination", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/events/typed/coordination")
    })

    it.each(LIFECYCLE_EVENT_KINDS)("routes '%s' to /ingest/v1/events/typed/lifecycle", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/events/typed/lifecycle")
    })

    it.each(TELEMETRY_EVENT_KINDS)("routes '%s' to /ingest/v1/events/typed/telemetry", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/events/typed/telemetry")
    })

    it("routes toolUsed to tool-activity endpoint", () => {
        expect(resolveIngestEndpoint(KIND.toolUsed)).toBe("/ingest/v1/events/typed/tool/activity")
    })

    it("routes terminalCommand to tool-activity endpoint", () => {
        expect(resolveIngestEndpoint(KIND.terminalCommand)).toBe("/ingest/v1/events/typed/tool/activity")
    })

    it("routes planLogged to workflow endpoint", () => {
        expect(resolveIngestEndpoint(KIND.planLogged)).toBe("/ingest/v1/events/typed/workflow")
    })

    it("routes userMessage to conversation endpoint", () => {
        expect(resolveIngestEndpoint(KIND.userMessage)).toBe("/ingest/v1/events/typed/conversation")
    })

    it("routes agentActivityLogged to coordination endpoint", () => {
        expect(resolveIngestEndpoint(KIND.agentActivityLogged)).toBe("/ingest/v1/events/typed/coordination")
    })

    it("routes sessionEnded to lifecycle endpoint", () => {
        expect(resolveIngestEndpoint(KIND.sessionEnded)).toBe("/ingest/v1/events/typed/lifecycle")
    })

    it("routes tokenUsage to telemetry endpoint", () => {
        expect(resolveIngestEndpoint(KIND.tokenUsage)).toBe("/ingest/v1/events/typed/telemetry")
    })

    it("falls back to workflow endpoint for unknown event kinds", () => {
        expect(resolveIngestEndpoint("unknown.event" as RuntimeIngestEventKind)).toBe("/ingest/v1/events/typed/workflow")
    })
})
