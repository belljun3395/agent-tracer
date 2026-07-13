import { describe, expect, it } from "vitest";
import {
    createApiErrorEnvelope,
    createApiSuccessEnvelope,
    isApiErrorEnvelope,
} from "./envelope.js";

describe("createApiSuccessEnvelope", () => {
    it("일반 값을 data에 담아 봉투로 포장한다", () => {
        expect(createApiSuccessEnvelope({ name: "a" })).toEqual({ ok: true, data: { name: "a" } });
    });

    it("이미 data를 가진 봉투는 다시 포장하지 않는다", () => {
        const envelope = { ok: true, data: { name: "a" } };
        expect(createApiSuccessEnvelope(envelope)).toBe(envelope);
    });

    it("ok만 있고 data가 없는 객체는 나머지 필드를 data로 승격한다", () => {
        expect(createApiSuccessEnvelope({ ok: true, name: "a" })).toEqual({ ok: true, data: { name: "a" } });
    });

    it("null과 undefined는 data를 null로 채운다", () => {
        expect(createApiSuccessEnvelope(null)).toEqual({ ok: true, data: null });
        expect(createApiSuccessEnvelope(undefined)).toEqual({ ok: true, data: null });
    });
});

describe("createApiErrorEnvelope", () => {
    it("details가 없으면 오류 봉투에 details 키를 넣지 않는다", () => {
        expect(createApiErrorEnvelope("BAD", "잘못됨")).toEqual({
            ok: false,
            error: { code: "BAD", message: "잘못됨" },
        });
    });

    it("details가 있으면 담는다", () => {
        expect(createApiErrorEnvelope("BAD", "잘못됨", { field: "x" })).toEqual({
            ok: false,
            error: { code: "BAD", message: "잘못됨", details: { field: "x" } },
        });
    });
});

describe("isApiErrorEnvelope", () => {
    it("code와 message를 가진 오류 봉투만 참으로 판정한다", () => {
        expect(isApiErrorEnvelope({ ok: false, error: { code: "X", message: "y" } })).toBe(true);
    });

    it("성공 봉투와 형태가 어긋난 값은 거짓으로 판정한다", () => {
        expect(isApiErrorEnvelope({ ok: true, data: 1 })).toBe(false);
        expect(isApiErrorEnvelope({ ok: false, error: { code: "X" } })).toBe(false);
        expect(isApiErrorEnvelope(null)).toBe(false);
    });
});
