import { describe, expect, it } from "vitest";
import { SessionEntity } from "./session.entity.js";
import { SESSION_STATUS } from "../task.const.js";

function makeSession(): SessionEntity {
    const session = new SessionEntity();
    session.status = SESSION_STATUS.active;
    session.summary = null;
    session.endedAt = null;
    return session;
}

describe("SessionEntity", () => {
    describe("end", () => {
        it("활성 세션을 종료 상태로 바꾸고 종료 시각·요약을 기록한다", () => {
            const session = makeSession();
            const at = new Date("2026-01-01T00:10:00.000Z");
            session.end("done", at);
            expect(session.status).toBe(SESSION_STATUS.ended);
            expect(session.endedAt).toEqual(at);
            expect(session.summary).toBe("done");
        });

        it("summary가 null이면 기존 summary를 덮어쓰지 않는다", () => {
            const session = makeSession();
            session.summary = "existing";
            session.end(null, new Date("2026-01-01T00:10:00.000Z"));
            expect(session.summary).toBe("existing");
        });

        it("이미 종료된 세션은 다시 종료하지 않는다", () => {
            const session = makeSession();
            const firstEnd = new Date("2026-01-01T00:10:00.000Z");
            session.end("first", firstEnd);
            session.end("second", new Date("2026-01-01T00:20:00.000Z"));
            expect(session.endedAt).toEqual(firstEnd);
            expect(session.summary).toBe("first");
        });
    });
});
