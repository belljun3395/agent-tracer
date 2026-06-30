import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { IIdGenerator } from "@monitor/shared/kernel/clock.js";
import { EventIngestController } from "./event.ingest.controller.js";
import type { IngestEventsUseCase } from "../application/ingest.events.usecase.js";
import type { EventBatchDto } from "./event.batch.schema.js";

function setup() {
    const execute = vi.fn(
        async (_input: { events: ReadonlyArray<{ id: string }> }) => ({ accepted: [], rejected: [] }),
    );
    const ingest = { execute } as unknown as IngestEventsUseCase & { execute: Mock };
    let n = 0;
    const idGen = { newUuid: () => "uuid", newUlid: () => `ULID${++n}` } as unknown as IIdGenerator;
    const controller = new EventIngestController(ingest, idGen);
    return { controller, execute };
}

const item = (over: Record<string, unknown>) =>
    ({ kind: "tool.used", taskId: "t-1", lane: "implementation", ...over });

describe("EventIngestController", () => {
    it("stamps a server ULID on events that arrive without an id", async () => {
        const { controller, execute } = setup();

        await controller.ingestEventsEndpoint({ events: [item({}), item({})] } as unknown as EventBatchDto);

        const sent = execute.mock.calls[0]![0].events;
        expect(sent.map((e) => e.id)).toEqual(["ULID1", "ULID2"]);
    });

    it("preserves a caller-supplied id (idempotency key honored)", async () => {
        const { controller, execute } = setup();

        await controller.ingestEventsEndpoint({ events: [item({ id: "given" })] } as unknown as EventBatchDto);

        const sent = execute.mock.calls[0]![0].events;
        expect(sent[0]!.id).toBe("given");
    });
});
