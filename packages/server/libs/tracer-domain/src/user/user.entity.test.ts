import { describe, expect, it } from "vitest";
import { UserEntity } from "./user.entity.js";

describe("UserEntity", () => {
    describe("register", () => {
        it("주어진 userId·email·시각으로 사용자를 만든다", () => {
            const now = new Date("2026-01-01T00:00:00.000Z");
            const user = UserEntity.register("u1", "user@example.com", now);
            expect(user.userId).toBe("u1");
            expect(user.email).toBe("user@example.com");
            expect(user.createdAt).toEqual(now);
        });
    });
});
