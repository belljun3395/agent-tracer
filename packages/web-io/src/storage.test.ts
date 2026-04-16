import { describe, expect, it } from "vitest";

import { createSafeStorage } from "./storage.js";

function createFakeStorage(): Storage {
    const data = new Map<string, string>();
    return {
        get length(): number {
            return data.size;
        },
        clear(): void {
            data.clear();
        },
        getItem(key: string): string | null {
            return data.has(key) ? (data.get(key) ?? null) : null;
        },
        key(index: number): string | null {
            const keys = Array.from(data.keys());
            return index >= 0 && index < keys.length ? (keys[index] ?? null) : null;
        },
        removeItem(key: string): void {
            data.delete(key);
        },
        setItem(key: string, value: string): void {
            data.set(key, value);
        }
    };
}

function createThrowingStorage(
    error: Error,
    operation: "read" | "write" | "both"
): Storage {
    const fake = createFakeStorage();
    return {
        ...fake,
        getItem(key: string): string | null {
            if (operation === "read" || operation === "both") {
                throw error;
            }
            return fake.getItem(key);
        },
        setItem(key: string, value: string): void {
            if (operation === "write" || operation === "both") {
                throw error;
            }
            fake.setItem(key, value);
        }
    };
}

const parseNumber = (raw: string): number | undefined => {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

describe("createSafeStorage", () => {
    it("returns fallback when underlying storage is missing", () => {
        const storage = createSafeStorage(null);

        expect(storage.isAvailable).toBe(false);
        expect(storage.get("zoom", parseNumber, 1)).toBe(1);
        expect(storage.set("zoom", "2").ok).toBe(false);
        expect(storage.set("zoom", "2").reason).toBe("unavailable");
    });

    it("reads and writes values through the parser", () => {
        const fake = createFakeStorage();
        const storage = createSafeStorage(fake);

        expect(storage.get("zoom", parseNumber, 1)).toBe(1);

        const writeResult = storage.set("zoom", "1.5");
        expect(writeResult.ok).toBe(true);
        expect(storage.get("zoom", parseNumber, 1)).toBe(1.5);
    });

    it("returns fallback when parser rejects the stored string", () => {
        const fake = createFakeStorage();
        fake.setItem("zoom", "not-a-number");
        const storage = createSafeStorage(fake);

        expect(storage.get("zoom", parseNumber, 1)).toBe(1);
    });

    it("returns fallback when the parser itself throws", () => {
        const fake = createFakeStorage();
        fake.setItem("reviewer", "raw");
        const storage = createSafeStorage(fake);

        const throwingParser = (): string | undefined => {
            throw new Error("parser blew up");
        };

        expect(storage.get("reviewer", throwingParser, "default")).toBe("default");
    });

    it("swallows read errors and returns fallback", () => {
        const throwing = createThrowingStorage(new Error("SecurityError"), "read");
        const storage = createSafeStorage(throwing);

        expect(storage.get("zoom", parseNumber, 3)).toBe(3);
    });

    it("classifies quota errors on write", () => {
        const quotaError = new Error("The quota has been exceeded.");
        quotaError.name = "QuotaExceededError";
        const throwing = createThrowingStorage(quotaError, "write");
        const storage = createSafeStorage(throwing);

        const result = storage.set("zoom", "2");
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("quota");
    });

    it("classifies SecurityError as unavailable on write", () => {
        const secError = new Error("access denied");
        secError.name = "SecurityError";
        const throwing = createThrowingStorage(secError, "write");
        const storage = createSafeStorage(throwing);

        const result = storage.set("zoom", "2");
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("unavailable");
    });

    it("falls back to 'unknown' when the write error is unrecognizable", () => {
        const generic = new Error("boom");
        const throwing = createThrowingStorage(generic, "write");
        const storage = createSafeStorage(throwing);

        const result = storage.set("zoom", "2");
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("unknown");
    });

    it("remove is a safe no-op when storage is null", () => {
        const storage = createSafeStorage(null);
        expect(() => {
            storage.remove("zoom");
        }).not.toThrow();
    });
});
