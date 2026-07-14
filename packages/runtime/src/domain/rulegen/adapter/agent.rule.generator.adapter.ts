import type {AiJobStepPayload} from "@monitor/kernel/job/job.step.const.js";
import {RULE_AGENT_RESULT_SUCCESS} from "~runtime/domain/rulegen/model/agent.message.model.js";
import type {
    RuleGenerationOutcome,
    RuleGenerationUsage,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {RulegenToolset} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import {TrajectoryRecorder} from "~runtime/domain/rulegen/model/trajectory.model.js";
import type {RuleAgentRunnerPort} from "~runtime/domain/rulegen/port/rule.agent.runner.port.js";
import type {RuleGeneratorPort} from "~runtime/domain/rulegen/port/rule.generator.port.js";
import {isRecord} from "~runtime/support/json.js";

const NO_RESULT = "no result message";

function toCandidates(structured: unknown): readonly unknown[] {
    if (!isRecord(structured)) return [];
    const rules = structured["rules"];
    return Array.isArray(rules) ? rules : [];
}

interface RunTotals {
    costUsd: number | null;
    numTurns: number | null;
    usage: RuleGenerationUsage | null;
}

/** 규칙 생성 명세를 실행기에 걸고 그 메시지 스트림을 제안 후보와 실행 궤적으로 조형한다. */
export class AgentRuleGeneratorAdapter implements RuleGeneratorPort {
    constructor(private readonly runner: RuleAgentRunnerPort) {}

    async generate(
        spec: RuleGenerationSpec,
        toolset: RulegenToolset,
        signal: AbortSignal,
    ): Promise<RuleGenerationOutcome> {
        const controller = new AbortController();
        const abort = (): void => controller.abort(signal.reason);
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, {once: true});

        const trajectory = new TrajectoryRecorder();
        // 도구 결과에는 도구 이름이 없어 같은 실행의 호출 ID로 이어 붙인다.
        const toolNameById = new Map<string, string>();
        const totals: RunTotals = {costUsd: null, numTurns: null, usage: null};

        try {
            for await (const message of this.runner.run({spec, toolset, controller})) {
                if (message.type === "assistant") {
                    for (const call of message.toolCalls) toolNameById.set(call.id, call.name);
                    trajectory.assistant({
                        content: message.text,
                        toolCalls: message.toolCalls,
                        inputTokens: message.usage?.inputTokens,
                        outputTokens: message.usage?.outputTokens,
                        cacheReadTokens: message.usage?.cacheReadTokens,
                        cacheCreationTokens: message.usage?.cacheCreationTokens,
                        ...(message.stopReason !== null ? {stopReason: message.stopReason} : {}),
                    });
                    continue;
                }
                if (message.type === "tool_result") {
                    trajectory.tool({
                        toolCallId: message.toolCallId,
                        toolName: toolNameById.get(message.toolCallId) ?? "",
                        content: message.text,
                    });
                    continue;
                }

                totals.costUsd = message.costUsd;
                totals.numTurns = message.numTurns;
                totals.usage = message.usage;
                if (message.subtype === RULE_AGENT_RESULT_SUCCESS) {
                    return outcome(totals, trajectory.snapshot(), {
                        candidates: toCandidates(message.structuredOutput),
                        error: null,
                    });
                }
                const errors = message.errors.length > 0 ? `: ${message.errors.join("; ")}` : "";
                return outcome(totals, trajectory.snapshot(), {error: `${message.subtype}${errors}`});
            }
            return outcome(totals, trajectory.snapshot(), {error: NO_RESULT});
        } catch (error) {
            return outcome(totals, trajectory.snapshot(), {
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            signal.removeEventListener("abort", abort);
        }
    }
}

function outcome(
    totals: RunTotals,
    steps: readonly AiJobStepPayload[],
    rest: {readonly candidates?: readonly unknown[]; readonly error: string | null},
): RuleGenerationOutcome {
    return {
        candidates: rest.candidates ?? [],
        costUsd: totals.costUsd,
        numTurns: totals.numTurns,
        usage: totals.usage,
        steps,
        error: rest.error,
    };
}
