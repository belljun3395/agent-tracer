import {POWERSHELL_TOOL_NAME, TERMINAL_COMMAND_TOOL_NAME} from "@monitor/kernel/ingest/event.kind.const.js";
import {detectCommandRepetition} from "~runtime/domain/hint/model/command.repetition.model.js";
import {detectContextPressure} from "~runtime/domain/hint/model/context.pressure.model.js";
import type {PreprocessingHint, PreprocessingHintsRequest} from "~runtime/domain/hint/model/hint.model.js";
import type {ClockPort} from "~runtime/domain/hint/port/clock.port.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

const COMMAND_TOOLS: ReadonlySet<string> = new Set([TERMINAL_COMMAND_TOOL_NAME, POWERSHELL_TOOL_NAME]);

/** 최근 이벤트와 요청을 알맞은 감지기에 분배한다. */
export class ComputeHintsUsecase {
    constructor(private readonly clock: ClockPort) {}

    execute(recent: readonly RecentEvent[], request: PreprocessingHintsRequest): PreprocessingHint[] {
        const now = this.clock.now();
        const hints: PreprocessingHint[] = [...detectContextPressure(recent, now)];
        if (request.trigger !== "pre_tool") return hints;

        const toolName = request.toolName ?? "";
        if (COMMAND_TOOLS.has(toolName) && request.command) {
            hints.push(...detectCommandRepetition(recent, request.command, now));
        }
        return hints;
    }
}
