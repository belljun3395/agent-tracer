import { describe, expect, it, vi } from "vitest";
import { SOCKET_READY_STATE, cleanupSocketOnUnmount } from "./useWebSocket.js";
describe("cleanupSocketOnUnmount", () => {
    it("아직 연결 중인 소켓은 바로 닫지 않고 deferClose로 넘긴다", () => {
        const close = vi.fn();
        const deferClose = vi.fn();
        cleanupSocketOnUnmount({
            socket: {
                readyState: SOCKET_READY_STATE.CONNECTING,
                close
            },
            deferClose
        });
        expect(close).not.toHaveBeenCalled();
        expect(deferClose).toHaveBeenCalledTimes(1);
    });
    it("이미 열린 소켓은 즉시 close 한다", () => {
        const close = vi.fn();
        const deferClose = vi.fn();
        cleanupSocketOnUnmount({
            socket: {
                readyState: SOCKET_READY_STATE.OPEN,
                close
            },
            deferClose
        });
        expect(close).toHaveBeenCalledTimes(1);
        expect(deferClose).not.toHaveBeenCalled();
    });
});
