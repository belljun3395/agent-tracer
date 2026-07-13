import {describe, expect, it} from "vitest";
import {classifyIngestStatus, parseRetryAfterMs} from "~runtime/daemon/delivery/ingest.retry.js";

describe("classifyIngestStatus", () => {
    it("2xx는 성공으로 분류한다", () => {
        expect(classifyIngestStatus(200)).toBe("ok");
        expect(classifyIngestStatus(202)).toBe("ok");
    });

    it("재시도해도 같은 4xx는 dead-letter로 분류한다", () => {
        expect(classifyIngestStatus(400)).toBe("dead");
        expect(classifyIngestStatus(413)).toBe("dead");
        expect(classifyIngestStatus(422)).toBe("dead");
    });

    it("나머지 4xx는 재시도로 분류한다", () => {
        expect(classifyIngestStatus(429)).toBe("retry");
        expect(classifyIngestStatus(401)).toBe("retry");
    });

    it("5xx는 서버 오류로 분류한다", () => {
        expect(classifyIngestStatus(500)).toBe("server-error");
        expect(classifyIngestStatus(503)).toBe("server-error");
    });
});

describe("parseRetryAfterMs", () => {
    it("헤더가 없으면 지연을 정하지 않는다", () => {
        expect(parseRetryAfterMs(null, 60_000)).toBeNull();
    });

    it("초 정수를 밀리초로 바꾸되 상한을 넘기지 않는다", () => {
        expect(parseRetryAfterMs("2", 60_000)).toBe(2000);
        expect(parseRetryAfterMs("600", 60_000)).toBe(60_000);
    });

    it("해석할 수 없는 헤더는 지연을 정하지 않는다", () => {
        expect(parseRetryAfterMs("soon", 60_000)).toBeNull();
    });
});
