import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret.js";

const ENV_KEY = "MONITOR_SETTINGS_ENCRYPTION_KEY";
let prevKey: string | undefined;

beforeEach(() => {
    prevKey = process.env[ENV_KEY];
});

afterEach(() => {
    if (prevKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prevKey;
});

describe("encryptSecret / decryptSecret", () => {
    it("암호화한 값을 복호화하면 원문으로 돌아온다", () => {
        process.env[ENV_KEY] = "test-key";
        const encrypted = encryptSecret("sk-ant-1234567890");
        expect(decryptSecret(encrypted)).toBe("sk-ant-1234567890");
    });

    it("같은 평문도 매번 다른 암호문을 만든다(랜덤 IV)", () => {
        process.env[ENV_KEY] = "test-key";
        const a = encryptSecret("same-value");
        const b = encryptSecret("same-value");
        expect(a).not.toBe(b);
    });

    it("암호화 포맷이 아닌 값을 복호화하려 하면 예외를 던진다", () => {
        expect(() => decryptSecret("plain-text-value")).toThrow();
    });

    it("변조된 암호문은 복호화 시 예외를 던진다(인증 태그 불일치)", () => {
        process.env[ENV_KEY] = "test-key";
        const encrypted = encryptSecret("sk-ant-1234567890");
        const tampered = encrypted.slice(0, -4) + "abcd";
        expect(() => decryptSecret(tampered)).toThrow();
    });
});

describe("isEncryptedSecret", () => {
    it("암호화된 값은 true를 반환한다", () => {
        process.env[ENV_KEY] = "test-key";
        expect(isEncryptedSecret(encryptSecret("value"))).toBe(true);
    });

    it("평문 값은 false를 반환한다", () => {
        expect(isEncryptedSecret("plain-text")).toBe(false);
    });
});
