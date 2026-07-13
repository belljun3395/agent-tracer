import { once } from "node:events";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startHealthServer, type ReadinessProbe } from "./health.server.js";

const servers: Server[] = [];

async function startServer(
    database: ReadinessProbe,
    dependencies: readonly ReadinessProbe[] = [],
    readinessTimeoutMs?: number,
): Promise<string> {
    const server = startHealthServer(0, "127.0.0.1", database, dependencies, readinessTimeoutMs);
    servers.push(server);
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("port allocation failed");
    return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("projector health server", () => {
    it("추가 의존성 점검이 실패하면 ready를 실패로 응답한다", async () => {
        const database = { ping: vi.fn(async () => undefined) };
        const baseUrl = await startServer(database, [
            {
                ping: async () => {
                    throw new Error("broker unavailable");
                },
            },
        ]);

        const response = await fetch(`${baseUrl}/health/ready`);

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({ status: "unavailable" });
        expect(database.ping).toHaveBeenCalledOnce();
    });

    it("의존성 점검이 멈추면 deadline 뒤 ready를 실패로 응답한다", async () => {
        const database = { ping: vi.fn(async () => undefined) };
        const baseUrl = await startServer(
            database,
            [{ ping: () => new Promise<void>(() => undefined) }],
            10,
        );

        const response = await fetch(`${baseUrl}/health/ready`);

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({ status: "unavailable" });
    });
});
