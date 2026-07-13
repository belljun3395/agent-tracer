import {detectCommandRepetition} from "~runtime/domain/hint/model/command.repetition.model.js";
import {detectContextPressure} from "~runtime/domain/hint/model/context.pressure.model.js";
import {detectDuplicateQuestion} from "~runtime/domain/hint/model/duplicate.question.model.js";
import type {PreprocessingHint, PreprocessingHintsRequest} from "~runtime/domain/hint/model/hint.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

const COMMAND_TOOLS: ReadonlySet<string> = new Set(["Bash", "PowerShell"]);

/** 최근 이벤트와 요청을 알맞은 감지기에 분배한다. */
export class ComputeHintsUsecase {
    execute(recent: readonly RecentEvent[], request: PreprocessingHintsRequest): PreprocessingHint[] {
        const hints: PreprocessingHint[] = [...detectContextPressure(recent)];
        if (request.trigger !== "pre_tool") return hints;

        const toolName = request.toolName ?? "";
        if (toolName === "AskUserQuestion" && request.questions && request.questions.length > 0) {
            hints.push(...detectDuplicateQuestion(recent, request.questions));
        }
        if (COMMAND_TOOLS.has(toolName) && request.command) {
            hints.push(...detectCommandRepetition(recent, request.command));
        }
        return hints;
    }
}
