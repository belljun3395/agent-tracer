import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { Response } from "express";
import { SseWriter } from "./chat.sse.writer.js";

/** express Response의 write/drain/off 표면만 흉내 내, 역압력을 원할 때 켜고 끄는 소켓 대역이다. */
class FakeSocket extends EventEmitter {
    frames: string[] = [];
    private full = false;

    fill(): void {
        this.full = true;
    }

    drain(): void {
        this.full = false;
        this.emit("drain");
    }

    asResponse(): Response {
        return this as unknown as Response;
    }

    write(chunk: string): boolean {
        this.frames.push(chunk);
        return !this.full;
    }
}

function settled(promise: Promise<void>): Promise<"resolved" | "pending"> {
    return Promise.race([
        promise.then(() => "resolved" as const),
        Promise.resolve().then(() => "pending" as const),
    ]);
}

describe("SseWriter", () => {
    it("버퍼가 비어 있으면 쓰기가 곧바로 이행된다", async () => {
        const socket = new FakeSocket();
        const writer = new SseWriter(socket.asResponse());

        await writer.write("assistant_delta", { text: "안녕" });

        expect(socket.frames.join("")).toContain("event: assistant_delta");
        expect(socket.frames.join("")).toContain('"text":"안녕"');
    });

    it("write가 false면 drain까지 다음 쓰기를 미뤄 역압력을 건다", async () => {
        const socket = new FakeSocket();
        const writer = new SseWriter(socket.asResponse());
        socket.fill();

        void writer.write("assistant_delta", { text: "a" });
        const second = writer.write("assistant_delta", { text: "b" });

        // 커널 버퍼가 찼으므로 첫 쓰기도, 그 뒤 큐잉된 쓰기도 아직 이행되지 않는다.
        expect(await settled(second)).toBe("pending");
        expect(socket.frames).toHaveLength(1);

        socket.drain();
        await second;
        expect(socket.frames).toHaveLength(2);
    });

    it("쓰기는 큐잉된 순서대로 나간다", async () => {
        const socket = new FakeSocket();
        const writer = new SseWriter(socket.asResponse());

        await Promise.all([
            writer.write("a", { n: 1 }),
            writer.write("b", { n: 2 }),
            writer.write("c", { n: 3 }),
        ]);

        expect(socket.frames.map((frame) => frame.split("\n")[0])).toEqual(["event: a", "event: b", "event: c"]);
    });

    it("연결이 닫히면 대기 중인 쓰기를 깨우고 이후 쓰기를 무력화한다", async () => {
        const socket = new FakeSocket();
        const writer = new SseWriter(socket.asResponse());
        socket.fill();

        const pending = writer.write("assistant_delta", { text: "a" });
        expect(await settled(pending)).toBe("pending");

        writer.close();
        await pending;

        await writer.write("assistant_delta", { text: "b" });
        // 닫힌 뒤의 쓰기는 소켓으로 나가지 않는다.
        expect(socket.frames).toHaveLength(1);
    });
});
