import type {RuleAgentMessage} from "~runtime/domain/rulegen/model/agent.message.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {RulegenToolset} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

export interface RuleAgentRunRequest {
    readonly spec: RuleGenerationSpec;
    readonly toolset: RulegenToolset;
    readonly controller: AbortController;
}

/** 규칙 생성 명세를 언어 모델 공급자에 걸어 메시지 스트림으로 돌려주는 실행기이며 명세를 해석하지 않는다. */
export interface RuleAgentRunnerPort {
    run(request: RuleAgentRunRequest): AsyncIterable<RuleAgentMessage>;
}
