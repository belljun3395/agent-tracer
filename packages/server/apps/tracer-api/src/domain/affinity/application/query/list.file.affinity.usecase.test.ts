import { describe, expect, it } from "vitest";
import { FileAffinityEntity } from "@monitor/tracer-domain";
import { InMemoryFileAffinityRepository } from "~tracer-api/domain/affinity/port/__fakes__/in-memory.file.affinity.repository.js";
import { ListFileAffinityUseCase } from "./list.file.affinity.usecase.js";

function makeRow(filePath: string, intentLabel: string, openCount: number): FileAffinityEntity {
    const row = new FileAffinityEntity();
    row.filePath = filePath;
    row.intentLabel = intentLabel;
    row.role = "write";
    row.openCount = openCount;
    row.lastSeenAt = new Date("2026-01-01T00:00:00.000Z");
    return row;
}

describe("ListFileAffinityUseCase", () => {
    it("intent가 없으면 조회 없이 빈 목록을 반환한다", async () => {
        const repo = new InMemoryFileAffinityRepository();
        const useCase = new ListFileAffinityUseCase(repo);
        const result = await useCase.execute(undefined, undefined);
        expect(result).toEqual({ intent: null, items: [] });
    });

    it("intent가 공백뿐이면 조회 없이 빈 목록을 반환한다", async () => {
        const repo = new InMemoryFileAffinityRepository();
        const useCase = new ListFileAffinityUseCase(repo);
        const result = await useCase.execute("   ", undefined);
        expect(result).toEqual({ intent: null, items: [] });
    });

    it("intent가 있으면 해당 파일 목록을 반환한다", async () => {
        const repo = new InMemoryFileAffinityRepository();
        repo.seed(makeRow("a.ts", "refactor", 3), makeRow("b.ts", "other-intent", 5));
        const useCase = new ListFileAffinityUseCase(repo);
        const result = await useCase.execute("refactor", undefined);
        expect(result.intent).toBe("refactor");
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.filePath).toBe("a.ts");
    });

    it("limit이 주어지면 결과 수를 그만큼으로 제한한다", async () => {
        const repo = new InMemoryFileAffinityRepository();
        repo.seed(
            makeRow("a.ts", "refactor", 3),
            makeRow("b.ts", "refactor", 5),
            makeRow("c.ts", "refactor", 1),
        );
        const useCase = new ListFileAffinityUseCase(repo);
        const result = await useCase.execute("refactor", 2);
        expect(result.items).toHaveLength(2);
    });
});
