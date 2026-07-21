import { DomainError } from "@monitor/platform";

/** 로컬 CLI 인증이 아닌 백엔드가 API 키 없이 대화 턴을 실행하려 했음을 알린다. */
export class ChatMissingApiKeyError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "chat.llm-key-missing";

    constructor() {
        super("LLM API key is not configured");
    }
}
