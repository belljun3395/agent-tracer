import { readFileSync } from "node:fs";
import type { ChatToolContract } from "./chat.contract.js";

// node:fs에 의존해 배럴 밖 깊은 import로만 여는, 두 백엔드와 커널 테스트가 같은 계약 파일을 읽게 하는 로더다.
export function loadChatToolContract(): ChatToolContract {
    const raw = readFileSync(
        new URL("./__fixtures__/chat.tool.contract.json", import.meta.url),
        "utf8",
    );
    return JSON.parse(raw) as ChatToolContract;
}
