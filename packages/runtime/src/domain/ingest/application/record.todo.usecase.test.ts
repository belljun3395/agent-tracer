import {describe, expect, it} from "vitest";
import {RecordTodoUsecase} from "~runtime/domain/ingest/application/record.todo.usecase.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {InMemoryTodoSnapshot} from "~runtime/domain/ingest/port/__fakes__/in-memory.todo.snapshot.js";

const TARGET = {taskId: "task-1", sessionId: "session-1"};

describe("RecordTodoUsecase", () => {
    it("새 할 일과 상태 전이만 이벤트로 남긴다", async () => {
        const sink = new InMemoryEventSink();
        const snapshots = new InMemoryTodoSnapshot();
        const usecase = new RecordTodoUsecase(sink, snapshots, "claude-plugin");
        const call = {
            toolName: "TodoWrite",
            toolInput: {todos: [{content: "테스트 실행", status: "pending"}]},
        };

        await usecase.execute(call, TARGET, "cc-1");
        await usecase.execute(call, TARGET, "cc-1");

        expect(sink.events).toHaveLength(1);
        expect(sink.events[0]?.payload["title"]).toBe("테스트 실행");
    });

    it("목록에서 사라진 미완료 할 일을 취소로 재조정한다", async () => {
        const sink = new InMemoryEventSink();
        const snapshots = new InMemoryTodoSnapshot();
        const usecase = new RecordTodoUsecase(sink, snapshots, "claude-plugin");

        await usecase.execute(
            {toolName: "TodoWrite", toolInput: {todos: [{content: "테스트 실행", status: "pending"}]}},
            TARGET,
            "cc-1",
        );
        await usecase.execute({toolName: "TodoWrite", toolInput: {todos: []}}, TARGET, "cc-1");

        const metadata = sink.events[1]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata["todoState"]).toBe("cancelled");
        expect(metadata["autoReconciled"]).toBe(true);
    });
});
