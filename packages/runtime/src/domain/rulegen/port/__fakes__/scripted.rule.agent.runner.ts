import type {RuleAgentMessage} from "~runtime/domain/rulegen/model/agent.message.model.js";
import type {
    RuleAgentRunnerPort,
    RuleAgentRunRequest,
} from "~runtime/domain/rulegen/port/rule.agent.runner.port.js";

/** 대본대로 메시지를 흘리는 가짜 모델이며 중단 신호가 서면 실제 SDK처럼 스트림 도중에 터진다. */
export class ScriptedRuleAgentRunner implements RuleAgentRunnerPort {
    readonly requests: RuleAgentRunRequest[] = [];

    constructor(
        private readonly messages: readonly RuleAgentMessage[],
        private readonly throwOnAbort: Error | null = null,
    ) {}

    async *run(request: RuleAgentRunRequest): AsyncIterable<RuleAgentMessage> {
        this.requests.push(request);
        for (const message of this.messages) {
            if (this.throwOnAbort !== null && request.controller.signal.aborted) throw this.throwOnAbort;
            yield await Promise.resolve(message);
        }
        if (this.throwOnAbort !== null && request.controller.signal.aborted) throw this.throwOnAbort;
    }
}
