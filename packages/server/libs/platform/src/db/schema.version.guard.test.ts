import { describe, expect, it } from "vitest";
import { checkSchemaVersion } from "./schema.version.guard.js";

describe("checkSchemaVersion", () => {
    it("기대하는 마이그레이션이 모두 적용됐으면 최신으로 판정한다", () => {
        const result = checkSchemaVersion(
            ["0001-Init", "0002-AddColumn"],
            ["0001-Init", "0002-AddColumn"],
        );

        expect(result.upToDate).toBe(true);
        expect(result.missingMigrations).toEqual([]);
    });

    it("적용 이력이 기대 목록을 초과해도 최신으로 판정한다", () => {
        const result = checkSchemaVersion(
            ["0001-Init", "0002-AddColumn", "0003-Future"],
            ["0001-Init", "0002-AddColumn"],
        );

        expect(result.upToDate).toBe(true);
    });

    it("최신 마이그레이션이 미적용이면 fail-fast 대상으로 판정한다", () => {
        const result = checkSchemaVersion(["0001-Init"], ["0001-Init", "0002-AddColumn"]);

        expect(result.upToDate).toBe(false);
        expect(result.missingMigrations).toEqual(["0002-AddColumn"]);
    });

    it("적용 이력이 비어 있으면 기대 목록 전체를 누락으로 보고한다", () => {
        const result = checkSchemaVersion([], ["0001-Init", "0002-AddColumn"]);

        expect(result.upToDate).toBe(false);
        expect(result.missingMigrations).toEqual(["0001-Init", "0002-AddColumn"]);
    });

    it("기대 목록이 비어 있으면 항상 최신으로 판정한다", () => {
        const result = checkSchemaVersion(["0001-Init"], []);

        expect(result.upToDate).toBe(true);
        expect(result.missingMigrations).toEqual([]);
    });

    it("같은 입력으로 반복 호출해도 같은 결과를 낸다", () => {
        const applied = ["0001-Init"];
        const expected = ["0001-Init", "0002-AddColumn"];

        const first = checkSchemaVersion(applied, expected);
        const second = checkSchemaVersion(applied, expected);

        expect(second).toEqual(first);
    });
});
