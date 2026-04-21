import { describe, expect, it } from "vitest";
import { getKnownRuntimeCapabilities } from "./runtime-capabilities.helpers.js";
import { registerDefaultRuntimeAdapters } from "./runtime-capabilities.defaults.js";

describe("registerDefaultRuntimeAdapters", () => {
    it("registers the Codex CLI capability profile", () => {
        registerDefaultRuntimeAdapters();

        expect(getKnownRuntimeCapabilities("codex-cli")).toMatchObject({
            canCaptureRawUserMessage: true,
            canObserveToolCalls: true,
            hasEventStream: true,
        });
    });
});
