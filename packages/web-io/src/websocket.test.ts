import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MonitorSocket } from "./websocket.js";

const READY_STATE_CONNECTING = 0;
const READY_STATE_OPEN = 1;
const READY_STATE_CLOSED = 3;

class FakeWebSocket {
    public readyState: number = READY_STATE_CONNECTING;
    public onopen: ((event: Event) => void) | null = null;
    public onmessage: ((event: MessageEvent) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public onclose: ((event: Event) => void) | null = null;
    public closed = false;

    constructor(public readonly url: string) {}

    close(): void {
        this.closed = true;
        this.readyState = READY_STATE_CLOSED;
    }

    simulateOpen(): void {
        this.readyState = READY_STATE_OPEN;
        this.onopen?.(new Event("open"));
    }

    simulateMessage(data: unknown): void {
        const event = { data } as MessageEvent;
        this.onmessage?.(event);
    }

    simulateError(): void {
        this.onerror?.(new Event("error"));
    }

    simulateClose(): void {
        this.readyState = READY_STATE_CLOSED;
        this.onclose?.(new Event("close"));
    }
}

interface FakeFactory {
    readonly ctor: typeof WebSocket;
    readonly sockets: readonly FakeWebSocket[];
    readonly latest: () => FakeWebSocket;
}

function createFakeWebSocketFactory(): FakeFactory {
    const sockets: FakeWebSocket[] = [];

    class TrackedFakeWebSocket extends FakeWebSocket {
        constructor(url: string) {
            super(url);
            sockets.push(this);
        }
    }

    return {
        ctor: TrackedFakeWebSocket as unknown as typeof WebSocket,
        sockets,
        latest: (): FakeWebSocket => {
            const last = sockets[sockets.length - 1];
            if (last === undefined) {
                throw new Error("no FakeWebSocket has been constructed");
            }
            return last;
        }
    };
}

function createThrowingCtor(error: Error): typeof WebSocket {
    class ThrowingWebSocket {
        constructor(_url: string) {
            throw error;
        }
    }
    return ThrowingWebSocket as unknown as typeof WebSocket;
}

describe("MonitorSocket", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("auto-connects and emits connectionChange(true) on open", () => {
        const factory = createFakeWebSocketFactory();
        const connectionEvents: boolean[] = [];
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });
        socket.on("connectionChange", (connected) => {
            connectionEvents.push(connected);
        });

        expect(socket.isConnected).toBe(false);
        factory.latest().simulateOpen();

        expect(socket.isConnected).toBe(true);
        expect(connectionEvents).toEqual([true]);

        socket.close();
    });

    it("emits string message payloads and ignores non-string frames", () => {
        const factory = createFakeWebSocketFactory();
        const received: string[] = [];
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });
        socket.on("message", (payload) => {
            received.push(payload);
        });

        const fake = factory.latest();
        fake.simulateOpen();
        fake.simulateMessage("hello");
        fake.simulateMessage(new ArrayBuffer(4));
        fake.simulateMessage("world");

        expect(received).toEqual(["hello", "world"]);

        socket.close();
    });

    it("emits connectionChange(false) on close and schedules reconnect", () => {
        const factory = createFakeWebSocketFactory();
        const connectionEvents: boolean[] = [];
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor,
            reconnectBaseMs: 100
        });
        socket.on("connectionChange", (connected) => {
            connectionEvents.push(connected);
        });

        const first = factory.latest();
        first.simulateOpen();
        first.simulateClose();

        expect(connectionEvents).toEqual([true, false]);
        expect(factory.sockets).toHaveLength(1);

        vi.advanceTimersByTime(100);
        expect(factory.sockets).toHaveLength(2);
        factory.latest().simulateOpen();
        expect(connectionEvents).toEqual([true, false, true]);

        socket.close();
    });

    it("applies exponential backoff before the cap", () => {
        const factory = createFakeWebSocketFactory();
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor,
            reconnectBaseMs: 100,
            reconnectMaxMs: 5000
        });

        // First connect + close -> attempt #1 after 100ms
        factory.latest().simulateOpen();
        factory.latest().simulateClose();
        expect(factory.sockets).toHaveLength(1);
        vi.advanceTimersByTime(99);
        expect(factory.sockets).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(factory.sockets).toHaveLength(2);

        // Second close before open -> attempt #2 after 200ms
        factory.latest().simulateClose();
        vi.advanceTimersByTime(199);
        expect(factory.sockets).toHaveLength(2);
        vi.advanceTimersByTime(1);
        expect(factory.sockets).toHaveLength(3);

        // Third close -> attempt #3 after 400ms
        factory.latest().simulateClose();
        vi.advanceTimersByTime(399);
        expect(factory.sockets).toHaveLength(3);
        vi.advanceTimersByTime(1);
        expect(factory.sockets).toHaveLength(4);

        socket.close();
    });

    it("resets backoff attempts after a successful open", () => {
        const factory = createFakeWebSocketFactory();
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor,
            reconnectBaseMs: 100
        });

        // Attempt #1 fails without opening -> 100ms before attempt #2
        factory.latest().simulateClose();
        vi.advanceTimersByTime(100);
        expect(factory.sockets).toHaveLength(2);

        // Attempt #2 fails -> 200ms before attempt #3
        factory.latest().simulateClose();
        vi.advanceTimersByTime(200);
        expect(factory.sockets).toHaveLength(3);

        // Attempt #3 opens successfully -> attempts reset
        factory.latest().simulateOpen();
        factory.latest().simulateClose();

        // Next attempt should be at base 100ms again, not 400ms
        vi.advanceTimersByTime(100);
        expect(factory.sockets).toHaveLength(4);

        socket.close();
    });

    it("stays disconnected when no WebSocket implementation is available", () => {
        vi.stubGlobal("WebSocket", undefined);
        const connectionEvents: boolean[] = [];
        const socket = new MonitorSocket({
            url: "ws://test"
        });
        socket.on("connectionChange", (connected) => {
            connectionEvents.push(connected);
        });

        expect(socket.isConnected).toBe(false);
        // No reconnect timer should fire because there is no ctor.
        vi.advanceTimersByTime(60_000);
        expect(socket.isConnected).toBe(false);

        socket.close();
        vi.unstubAllGlobals();
    });

    it("schedules a reconnect when the WebSocket constructor throws", () => {
        const ctor = createThrowingCtor(new Error("invalid url"));
        const socket = new MonitorSocket({
            url: "ws://bad",
            webSocketCtor: ctor,
            reconnectBaseMs: 100
        });

        // First dial threw synchronously. Reconnect should be scheduled.
        vi.advanceTimersByTime(100);
        // The ctor still throws on retry; we just verify no unhandled rejection
        // and that the socket is still marked disconnected.
        expect(socket.isConnected).toBe(false);

        socket.close();
    });

    it("closes a socket that opens after close() was called", () => {
        const factory = createFakeWebSocketFactory();
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });

        const fake = factory.latest();
        expect(fake.readyState).toBe(READY_STATE_CONNECTING);

        socket.close();
        expect(fake.closed).toBe(false);

        // Handshake completes after close() was requested.
        fake.simulateOpen();
        expect(fake.closed).toBe(true);
        expect(socket.isConnected).toBe(false);
    });

    it("is safe to close multiple times", () => {
        const factory = createFakeWebSocketFactory();
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });
        factory.latest().simulateOpen();

        expect(() => {
            socket.close();
            socket.close();
            socket.close();
        }).not.toThrow();
    });

    it("does not dial when autoConnect is false", () => {
        const factory = createFakeWebSocketFactory();
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor,
            autoConnect: false
        });

        expect(factory.sockets).toHaveLength(0);
        expect(socket.isConnected).toBe(false);

        socket.close();
    });

    it("allows listeners to unsubscribe", () => {
        const factory = createFakeWebSocketFactory();
        const received: string[] = [];
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });
        const unsubscribe = socket.on("message", (payload) => {
            received.push(payload);
        });

        factory.latest().simulateOpen();
        factory.latest().simulateMessage("first");
        unsubscribe();
        factory.latest().simulateMessage("second");

        expect(received).toEqual(["first"]);

        socket.close();
    });

    it("isolates listener errors so other listeners still run", () => {
        const factory = createFakeWebSocketFactory();
        const received: string[] = [];
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });
        socket.on("message", () => {
            throw new Error("listener blew up");
        });
        socket.on("message", (payload) => {
            received.push(payload);
        });

        factory.latest().simulateOpen();
        expect(() => {
            factory.latest().simulateMessage("payload");
        }).not.toThrow();
        expect(received).toEqual(["payload"]);

        socket.close();
    });

    it("marks disconnected when the socket emits an error before closing", () => {
        const factory = createFakeWebSocketFactory();
        const connectionEvents: boolean[] = [];
        const socket = new MonitorSocket({
            url: "ws://test",
            webSocketCtor: factory.ctor
        });
        socket.on("connectionChange", (connected) => {
            connectionEvents.push(connected);
        });

        const fake = factory.latest();
        fake.simulateOpen();
        expect(connectionEvents).toEqual([true]);
        fake.simulateError();
        expect(connectionEvents).toEqual([true, false]);

        socket.close();
    });
});
