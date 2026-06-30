import { describe, expect, it } from "vitest"
import { KIND } from "../events/kinds.const.js"
import type { RuntimeIngestEventKind } from "../events/kinds.type.js"
import { resolveIngestEndpoint, TOOL_ACTIVITY_EVENT_KINDS, WORKFLOW_EVENT_KINDS, CONVERSATION_EVENT_KINDS, COORDINATION_EVENT_KINDS, LIFECYCLE_EVENT_KINDS, TELEMETRY_EVENT_KINDS, RUNTIME_INGEST_EVENT_KINDS } from "./ingest.routing.js"

describe("resolveIngestEndpoint", () => {
    it("assigns every declared runtime event kind to a routing group", () => {
        expect(new Set(RUNTIME_INGEST_EVENT_KINDS)).toEqual(new Set(Object.values(KIND)))
    })

    it.each(TOOL_ACTIVITY_EVENT_KINDS)("routes '%s' to /ingest/v1/timeline/tool-activity", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/timeline/tool-activity")
    })

    it.each(WORKFLOW_EVENT_KINDS)("routes '%s' to /ingest/v1/timeline/workflow", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/timeline/workflow")
    })

    it.each(CONVERSATION_EVENT_KINDS)("routes '%s' to /ingest/v1/timeline/conversation", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/timeline/conversation")
    })

    it.each(COORDINATION_EVENT_KINDS)("routes '%s' to /ingest/v1/timeline/coordination", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/timeline/coordination")
    })

    it.each(LIFECYCLE_EVENT_KINDS)("routes '%s' to /ingest/v1/timeline/lifecycle", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/timeline/lifecycle")
    })

    it.each(TELEMETRY_EVENT_KINDS)("routes '%s' to /ingest/v1/timeline/telemetry", (kind) => {
        expect(resolveIngestEndpoint(kind)).toBe("/ingest/v1/timeline/telemetry")
    })

    it("routes toolUsed to tool-activity endpoint", () => {
        expect(resolveIngestEndpoint(KIND.toolUsed)).toBe("/ingest/v1/timeline/tool-activity")
    })

    it("routes terminalCommand to tool-activity endpoint", () => {
        expect(resolveIngestEndpoint(KIND.terminalCommand)).toBe("/ingest/v1/timeline/tool-activity")
    })

    it("routes planLogged to workflow endpoint", () => {
        expect(resolveIngestEndpoint(KIND.planLogged)).toBe("/ingest/v1/timeline/workflow")
    })

    it("routes userMessage to conversation endpoint", () => {
        expect(resolveIngestEndpoint(KIND.userMessage)).toBe("/ingest/v1/timeline/conversation")
    })

    it("routes agentActivityLogged to coordination endpoint", () => {
        expect(resolveIngestEndpoint(KIND.agentActivityLogged)).toBe("/ingest/v1/timeline/coordination")
    })

    it("routes sessionEnded to lifecycle endpoint", () => {
        expect(resolveIngestEndpoint(KIND.sessionEnded)).toBe("/ingest/v1/timeline/lifecycle")
    })

    // 서버가 workflow 그룹으로 수용하는 kind들 — lifecycle/conversation으로 보내면 400 드롭됨.
    it("routes fileChanged to workflow endpoint", () => {
        expect(resolveIngestEndpoint(KIND.fileChanged)).toBe("/ingest/v1/timeline/workflow")
    })

    it("routes permissionRequest to workflow endpoint", () => {
        expect(resolveIngestEndpoint(KIND.permissionRequest)).toBe("/ingest/v1/timeline/workflow")
    })

    it("routes userPromptExpansion to workflow endpoint", () => {
        expect(resolveIngestEndpoint(KIND.userPromptExpansion)).toBe("/ingest/v1/timeline/workflow")
    })

    it("routes tokenUsage to telemetry endpoint", () => {
        expect(resolveIngestEndpoint(KIND.tokenUsage)).toBe("/ingest/v1/timeline/telemetry")
    })

    it("falls back to workflow endpoint for unknown event kinds", () => {
        expect(resolveIngestEndpoint("unknown.event" as RuntimeIngestEventKind)).toBe("/ingest/v1/timeline/workflow")
    })
})
