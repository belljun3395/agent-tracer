import { z } from "zod";

// 어느 백엔드로 실행하든 대화 턴 하나가 돌려주는 구조화 출력이며, graph 백엔드가 이 모양으로 결과를 낸다.

// 모델이 제안한 쓰기 하나이며 toolName과 검증 전 원본 인자를 담는다.
const chatProposedWriteSchema = z.object({
    toolName: z.string().trim().min(1),
    args: z.record(z.unknown()),
});

// 모델이 기억한 사실 하나다.
const chatMemoryWriteSchema = z.object({
    key: z.string().trim().min(1),
    content: z.string(),
});

export const chatTurnResultSchema = z.object({
    assistantText: z.string(),
    proposedWrites: z.array(chatProposedWriteSchema),
    memoryWrites: z.array(chatMemoryWriteSchema),
});

export type ChatTurnResultPayload = z.infer<typeof chatTurnResultSchema>;
