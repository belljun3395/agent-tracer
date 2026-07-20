import {KIND} from "@monitor/kernel";
import {AGENT_TRACER_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {ComputeHintsUsecase} from "~runtime/domain/hint/application/compute.hints.usecase.js";
import {FixedClock} from "~runtime/domain/hint/port/__fakes__/fixed.clock.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

const NOW = new Date("2026-07-14T04:00:00.000Z");
const usecase = new ComputeHintsUsecase(new FixedClock(NOW.getTime()));

function at(ageMs: number): string {
    return new Date(NOW.getTime() - ageMs).toISOString();
}

describe("ComputeHintsUsecase", () => {
    it("컨텍스트 압력은 계기와 무관하게 항상 판정한다", () => {
        const recent: RecentEvent[] = [{
            kind: KIND.contextSnapshot,
            occurredAt: at(60_000),
            metadata: {contextWindowUsedPct: 96},
        }];

        expect(usecase.execute(recent, {trigger: "user_prompt"})).toContainEqual(
            expect.objectContaining({type: "context_pressure", severity: "critical"}),
        );
    });

    it("명령 감지기는 도구 앞 요청에서만 돈다", () => {
        const recent: RecentEvent[] = [1, 2, 3].map((minute) => ({
            kind: KIND.executeTool,
            occurredAt: at(minute * 60_000),
            toolName: "Bash",
            metadata: {[AGENT_TRACER_ATTR.command]: "npm test"},
        }));

        expect(usecase.execute(recent, {trigger: "user_prompt"})).toEqual([]);
    });

    it("같은 명령을 10분 안에 세 번 돌리면 경고한다", () => {
        const recent: RecentEvent[] = [1, 2, 3].map((minute) => ({
            kind: KIND.executeTool,
            occurredAt: at(minute * 60_000),
            toolName: "Bash",
            metadata: {[AGENT_TRACER_ATTR.command]: "npm test"},
        }));

        expect(usecase.execute(recent, {trigger: "pre_tool", toolName: "Bash", command: "npm test"}))
            .toContainEqual(expect.objectContaining({type: "command_repetition", severity: "warning"}));
    });
});
