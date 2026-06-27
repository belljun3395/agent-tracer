import { Injectable } from "@nestjs/common";
import { CommandRepetitionDetector } from "./detectors/command.repetition.detector.js";
import { ContextPressureDetector } from "./detectors/context.pressure.detector.js";
import { DuplicateQuestionDetector } from "./detectors/duplicate.question.detector.js";
import type {
    GetPreprocessingHintsUseCaseIn,
    GetPreprocessingHintsUseCaseOut,
    PreprocessingHint,
} from "./dto/preprocessing.hints.dto.js";

@Injectable()
export class GetPreprocessingHintsUseCase {
    constructor(
        private readonly contextPressure: ContextPressureDetector,
        private readonly duplicateQuestion: DuplicateQuestionDetector,
        private readonly commandRepetition: CommandRepetitionDetector,
    ) {}

    async execute(input: GetPreprocessingHintsUseCaseIn): Promise<GetPreprocessingHintsUseCaseOut> {

        const hints: PreprocessingHint[] = [];
        const pressure = await this.contextPressure.detect(input.taskId);
        hints.push(...pressure);

        if (input.trigger === "pre_tool") {
            if (input.toolName === "AskUserQuestion" && input.questions && input.questions.length > 0) {
                const dup = await this.duplicateQuestion.detect(input.taskId, input.questions);
                hints.push(...dup);
            }
            if ((input.toolName === "Bash" || input.toolName === "PowerShell") && input.command) {
                const cmd = await this.commandRepetition.detect(input.taskId, input.command);
                hints.push(...cmd);
            }
        }

        return { hints };
    }
}
