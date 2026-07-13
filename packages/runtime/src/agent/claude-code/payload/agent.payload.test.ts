import {describe, expect, it} from "vitest";
import {
    readSubagentStart,
    readSubagentStop,
    readTaskLifecycle,
} from "~runtime/agent/claude-code/payload/agent.payload.js";

describe("서브에이전트 페이로드 리더", () => {
    it("공식 agent_type과 agent transcript 경로를 읽는다", () => {
        expect(readSubagentStop({
            session_id: "parent-session",
            agent_id: "agent-1",
            agent_type: "Explore",
            agent_transcript_path: "/tmp/agent-1.jsonl",
            stop_reason: "end_turn",
        })).toEqual({
            ok: true,
            value: expect.objectContaining({
                sessionId: "parent-session",
                agentId: "agent-1",
                agentType: "Explore",
                subagentType: "Explore",
                agentTranscriptPath: "/tmp/agent-1.jsonl",
                stopReason: "end_turn",
            }),
        });
    });

    it("옛 subagent_type 입력도 같은 타입으로 정규화한다", () => {
        expect(readSubagentStart({
            session_id: "parent-session",
            agent_id: "agent-2",
            subagent_type: "legacy-agent",
        })).toEqual({
            ok: true,
            value: expect.objectContaining({agentType: "legacy-agent", subagentType: "legacy-agent"}),
        });
    });

    it("에이전트 타입이 없으면 agent_id를 표시 타입으로 쓴다", () => {
        expect(readSubagentStart({session_id: "parent-session", agent_id: "agent-3"})).toEqual({
            ok: true,
            value: expect.objectContaining({agentType: undefined, subagentType: "agent-3"}),
        });
    });

    it("에이전트 타입과 식별자가 모두 없으면 건너뛴다", () => {
        expect(readSubagentStop({session_id: "parent-session"})).toEqual({
            ok: false,
            reason: "missing agent_type",
        });
    });
});

describe("태스크 수명주기 페이로드 리더", () => {
    it("이름이 없는 태스크는 건너뛴다", () => {
        expect(readTaskLifecycle({session_id: "session-1"})).toEqual({
            ok: false,
            reason: "missing task_name",
        });
    });

    it("이름과 설명을 정규화한다", () => {
        expect(readTaskLifecycle({
            session_id: "session-1",
            task_name: "린트 고치기",
            task_description: "eslint 오류 제거",
        })).toEqual({
            ok: true,
            value: expect.objectContaining({taskName: "린트 고치기", taskDescription: "eslint 오류 제거"}),
        });
    });
});
