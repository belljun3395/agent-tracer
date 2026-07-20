import {AGENT_TRACER_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {detectCommandRepetition} from "~runtime/domain/hint/model/command.repetition.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

const NOW = Date.parse("2026-07-16T00:00:00.000Z");

function ran(command: string, minutesAgo = 1): RecentEvent {
    return {
        kind: "execute_tool",
        occurredAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
        metadata: {[AGENT_TRACER_ATTR.command]: command},
    };
}

describe("detectCommandRepetition", () => {
    it("글자까지 같은 명령이 세 번 이상이면 경고한다", () => {
        const recent = [ran("npm run test"), ran("npm run test"), ran("npm run test")];
        const hints = detectCommandRepetition(recent, "npm run test", NOW);
        expect(hints).toHaveLength(1);
        expect(hints[0]?.type).toBe("command_repetition");
    });

    it("세 번에 못 미치면 조용하다", () => {
        const recent = [ran("npm run test"), ran("npm run test")];
        expect(detectCommandRepetition(recent, "npm run test", NOW)).toHaveLength(0);
    });

    it("같은 경로를 건드릴 뿐 명령이 다르면 조용하다", () => {
        const recent = [ran("grep a packages/runtime/src"), ran("grep b packages/runtime/src"), ran("grep c packages/runtime/src")];
        expect(detectCommandRepetition(recent, "grep d packages/runtime/src", NOW)).toHaveLength(0);
    });

    it("10분보다 오래된 반복은 세지 않는다", () => {
        const recent = [ran("npm run test", 30), ran("npm run test", 20), ran("npm run test", 15)];
        expect(detectCommandRepetition(recent, "npm run test", NOW)).toHaveLength(0);
    });
});
