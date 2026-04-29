import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { RuntimeBindingService } from "./runtime.binding.service.js";
import type { RuntimeBindingRepository } from "../repository/runtime.binding.repository.js";
import { RuntimeBindingEntity } from "../domain/runtime.binding.entity.js";
import type { IClock } from "../application/outbound/clock.port.js";

const NOW_ISO = "2026-04-29T10:00:00.000Z";

function makeEntity(overrides: Partial<RuntimeBindingEntity> = {}): RuntimeBindingEntity {
    const e = new RuntimeBindingEntity();
    e.runtimeSource = "claude-code";
    e.runtimeSessionId = "rt-1";
    e.taskId = "task-1";
    e.monitorSessionId = "ms-1";
    e.createdAt = "2026-01-01T00:00:00.000Z";
    e.updatedAt = "2026-01-01T00:00:00.000Z";
    Object.assign(e, overrides);
    return e;
}

function setup(opts: { existing?: RuntimeBindingEntity | null } = {}) {
    const repo = {
        findByKey: vi.fn(async () => opts.existing ?? null),
        findActive: vi.fn(),
        save: vi.fn(async (e: RuntimeBindingEntity) => e),
        delete: vi.fn(async () => undefined),
    } as unknown as RuntimeBindingRepository & { findByKey: Mock; save: Mock };
    const clock: IClock & { nowIso: Mock; nowMs: Mock } = {
        nowIso: vi.fn(() => NOW_ISO),
        nowMs: vi.fn(() => Date.parse(NOW_ISO)),
    };
    const service = new RuntimeBindingService(repo, clock);
    return { service, repo, clock };
}

describe("RuntimeBindingService.upsert", () => {
    it("creates a new entity stamping createdAt and updatedAt with IClock", async () => {
        const h = setup({ existing: null });

        const out = await h.service.upsert({
            runtimeSource: "claude-code",
            runtimeSessionId: "rt-1",
            taskId: "task-1",
            monitorSessionId: "ms-1",
        });

        expect(h.clock.nowIso).toHaveBeenCalled();
        const saved = h.repo.save.mock.calls[0]![0] as RuntimeBindingEntity;
        expect(saved.createdAt).toBe(NOW_ISO);
        expect(saved.updatedAt).toBe(NOW_ISO);
        expect(out.updatedAt).toBe(NOW_ISO);
    });

    it("preserves the existing createdAt on update, only stamps updatedAt with IClock", async () => {
        const existing = makeEntity({ createdAt: "2026-01-01T00:00:00.000Z" });
        const h = setup({ existing });

        await h.service.upsert({
            runtimeSource: "claude-code",
            runtimeSessionId: "rt-1",
            taskId: "task-2",
            monitorSessionId: "ms-2",
        });

        const saved = h.repo.save.mock.calls[0]![0] as RuntimeBindingEntity;
        expect(saved.createdAt).toBe("2026-01-01T00:00:00.000Z");
        expect(saved.updatedAt).toBe(NOW_ISO);
        expect(saved.taskId).toBe("task-2");
        expect(saved.monitorSessionId).toBe("ms-2");
    });
});

describe("RuntimeBindingService.clearSession", () => {
    it("is a no-op when no entity exists for the key", async () => {
        const h = setup({ existing: null });

        await h.service.clearSession("claude-code", "rt-missing");

        expect(h.repo.save).not.toHaveBeenCalled();
        expect(h.clock.nowIso).not.toHaveBeenCalled();
    });

    it("nulls monitorSessionId and stamps updatedAt with IClock", async () => {
        const existing = makeEntity({ monitorSessionId: "ms-old" });
        const h = setup({ existing });

        await h.service.clearSession("claude-code", "rt-1");

        const saved = h.repo.save.mock.calls[0]![0] as RuntimeBindingEntity;
        expect(saved.monitorSessionId).toBeNull();
        expect(saved.updatedAt).toBe(NOW_ISO);
    });
});
