import { describe, expect, it } from "vitest";
import { UserEntity } from "@monitor/tracer-domain";
import { InMemoryUserRepository } from "~tracer-api/domain/user/port/__fakes__/in-memory.user.repository.js";
import { GetCurrentUserUseCase } from "./get.current.user.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeUseCase(users: readonly UserEntity[]): GetCurrentUserUseCase {
    const repo = new InMemoryUserRepository();
    repo.seed(...users);
    return new GetCurrentUserUseCase(repo);
}

describe("GetCurrentUserUseCase", () => {
    it("등록된 사용자면 이메일을 함께 낸다", async () => {
        const useCase = makeUseCase([UserEntity.register("u1", "me@example.com", NOW)]);

        const result = await useCase.execute("u1");

        expect(result).toEqual({ userId: "u1", email: "me@example.com" });
    });

    it("등록되지 않은 사용자면 식별자만 낸다", async () => {
        const useCase = makeUseCase([]);

        const result = await useCase.execute("u1");

        expect(result).toEqual({ userId: "u1" });
    });
});
