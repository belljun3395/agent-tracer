import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_AGENT_BACKEND, JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import { LLM_KEY_SETTING } from "@monitor/tracer-domain/settings/settings.const.js";
import { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import { InMemorySettingReader } from "~tracer-api/domain/job/port/__fakes__/in-memory.setting.reader.js";
import type { WorkflowDispatcherPort } from "~tracer-api/domain/job/port/workflow.dispatcher.port.js";
import { EnqueueJobUseCase } from "./enqueue.job.usecase.js";

function makeSettings(values: ReadonlyMap<string, string> = new Map([[LLM_KEY_SETTING, "sk-test"]])): InMemorySettingReader {
    return new InMemorySettingReader(values);
}

function makeDispatcher() {
    return {
        start: vi.fn<WorkflowDispatcherPort["start"]>(),
    } as unknown as WorkflowDispatcherPort & { readonly start: ReturnType<typeof vi.fn<WorkflowDispatcherPort["start"]>> };
}

function makeUseCase(settings: InMemorySettingReader = makeSettings()) {
    const store = new InMemoryAiJobRepository();
    const dispatcher = makeDispatcher();
    const useCase = new EnqueueJobUseCase(store, settings, dispatcher);
    return { store, dispatcher, useCase };
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("EnqueueJobUseCase", () => {
    it("같은 idempotency key와 같은 input이면 기존 Job을 반환한다", async () => {
        const { store, useCase } = makeUseCase();

        const first = await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: { status: "active", limit: 10 } },
            { idempotencyKey: "scan-click-1" },
        );
        const second = await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: { limit: 10, status: "active" } },
            { idempotencyKey: "scan-click-1" },
        );

        expect(store.all()).toHaveLength(1);
        expect(second.job.id).toBe(first.job.id);
    });

    it("같은 idempotency key에 다른 input이면 충돌로 거부한다", async () => {
        const { store, useCase } = makeUseCase();

        await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: { status: "active" } },
            { idempotencyKey: "scan-click-1" },
        );

        await expect(
            useCase.execute(
                "u1",
                JOB_KIND.recipeScan,
                { filters: { status: "archived" } },
                { idempotencyKey: "scan-click-1" },
            ),
        ).rejects.toMatchObject({
            code: "job.idempotency-conflict",
            httpStatus: 409,
        });
        expect(store.all()).toHaveLength(1);
    });

    it("기존 pending Temporal Job을 재사용하면 workflow start를 다시 시도한다", async () => {
        const { dispatcher, useCase } = makeUseCase();
        const first = await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: {} },
            { idempotencyKey: "scan-click-1" },
        );
        dispatcher.start.mockClear();

        await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: {} },
            { idempotencyKey: "scan-click-1" },
        );

        expect(dispatcher.start).toHaveBeenCalledOnce();
        expect(dispatcher.start).toHaveBeenCalledWith(
            JOB_KIND.recipeScan,
            first.job.id,
            "u1",
            { filters: {}, agentBackend: AI_AGENT_BACKEND.python },
        );
    });

    it("선택한 agent backend를 job input에 저장하고 workflow로 전달한다", async () => {
        const { dispatcher, store, useCase } = makeUseCase();

        await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { taskId: "task-1" },
            { idempotencyKey: "scan-claude", agentBackend: AI_AGENT_BACKEND.claudeSdk },
        );

        expect(store.all()[0]?.input).toEqual({
            taskId: "task-1",
            agentBackend: AI_AGENT_BACKEND.claudeSdk,
        });
        expect(dispatcher.start).toHaveBeenCalledWith(
            JOB_KIND.recipeScan,
            store.all()[0]?.id,
            "u1",
            { taskId: "task-1", agentBackend: AI_AGENT_BACKEND.claudeSdk },
        );
    });

    it("LLM 키가 없으면 원격 실행 잡을 큐에 넣지 못한다", async () => {
        const { useCase } = makeUseCase(makeSettings(new Map()));

        await expect(
            useCase.execute(
                "u1",
                JOB_KIND.recipeScan,
                { taskId: "task-1" },
                { agentBackend: AI_AGENT_BACKEND.claudeSdk },
            ),
        ).rejects.toMatchObject({
            code: "job.llm-key-missing",
            httpStatus: 400,
        });
    });

    it("요청이 backend를 생략하면 서버 기본값을 확정해 같은 provider 키와 workflow 입력을 사용한다", async () => {
        vi.stubEnv("AGENT_BACKEND", AI_AGENT_BACKEND.claudeSdk);
        const { dispatcher, store, useCase } = makeUseCase();

        await useCase.execute("u1", JOB_KIND.recipeScan, { taskId: "task-1" });

        expect(store.all()[0]?.input).toEqual({
            taskId: "task-1",
            agentBackend: AI_AGENT_BACKEND.claudeSdk,
        });
        expect(dispatcher.start).toHaveBeenCalledWith(
            JOB_KIND.recipeScan,
            store.all()[0]?.id,
            "u1",
            { taskId: "task-1", agentBackend: AI_AGENT_BACKEND.claudeSdk },
        );
    });

    it("종료된 Temporal Job을 재사용하면 workflow start를 다시 시도하지 않는다", async () => {
        const { dispatcher, store, useCase } = makeUseCase();
        await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: {} },
            { idempotencyKey: "scan-click-1" },
        );
        store.all()[0]?.complete({}, {}, new Date("2026-01-01T00:01:00.000Z"));
        dispatcher.start.mockClear();

        const result = await useCase.execute(
            "u1",
            JOB_KIND.recipeScan,
            { filters: {} },
            { idempotencyKey: "scan-click-1" },
        );

        expect(result.job.status).toBe(JOB_STATUS.completed);
        expect(dispatcher.start).not.toHaveBeenCalled();
    });
});
