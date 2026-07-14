import { describe, expect, it } from "vitest";
import type { UserEntity } from "@monitor/tracer-domain";
import { InMemoryUserRepository } from "~tracer-api/domain/user/port/__fakes__/in-memory.user.repository.js";
import { FixedClock } from "~tracer-api/domain/user/port/__fakes__/fixed.clock.js";
import { OnboardUserUseCase } from "./onboard.user.usecase.js";

function makeUseCase(): { useCase: OnboardUserUseCase; stored: () => readonly UserEntity[] } {
    const repo = new InMemoryUserRepository();
    return {
        useCase: new OnboardUserUseCase(repo, new FixedClock(new Date("2026-01-01T00:00:00.000Z"))),
        stored: () => repo.all(),
    };
}

describe("OnboardUserUseCase", () => {
    it("이메일의 공백과 대소문자를 정규화해 등록한다", async () => {
        const { useCase, stored } = makeUseCase();

        const result = await useCase.execute("u1", "  Me@Example.COM  ");

        expect(result).toEqual({ userId: "u1", email: "me@example.com" });
        expect(stored().find((user) => user.userId === "u1")?.email).toBe("me@example.com");
    });
});
