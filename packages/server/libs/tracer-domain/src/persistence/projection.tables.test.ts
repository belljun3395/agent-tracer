import { describe, expect, it } from "vitest";
import {
    OWNED_TABLES,
    REBUILDABLE_TABLES,
    REBUILD_TRUNCATE_ORDER,
    assertRebuildable,
    isOwnedTable,
    isRebuildableTable,
} from "./projection.tables.js";
import { tracerTableNames } from "./tracer.table.catalog.js";

describe("프로젝션 분류", () => {
    it("모든 테이블이 재생 가능·소유 중 정확히 한쪽으로 분류된다", () => {
        const classified = [...REBUILDABLE_TABLES, ...OWNED_TABLES];

        // 같은 테이블이 양쪽에 있으면 리빌드가 소유 데이터를 지운다.
        expect(new Set(classified).size).toBe(classified.length);
    });

    it("스키마에 있는 테이블 중 분류되지 않은 것이 없다", () => {
        const tables = tracerTableNames();
        // 엔티티 메타데이터를 못 읽는 환경에서는 이 단언이 의미를 잃으므로 목록이 비면 실패시킨다.
        expect(tables.length).toBeGreaterThan(0);

        const unclassified = tables.filter((table) => !isRebuildableTable(table) && !isOwnedTable(table));

        expect(unclassified).toEqual([]);
    });

    it("소유 테이블을 지우려 하면 거부한다", () => {
        expect(() => {
            assertRebuildable("rules");
        }).toThrow(/재생 가능한 테이블만/);
        expect(() => {
            assertRebuildable("ai_jobs");
        }).toThrow();
    });

    it("재생 가능한 테이블은 통과시킨다", () => {
        expect(() => {
            assertRebuildable("events");
        }).not.toThrow();
    });

    it("삭제 순서가 재생 가능한 테이블 전부를 빠짐없이 담는다", () => {
        expect([...REBUILD_TRUNCATE_ORDER].sort()).toEqual([...REBUILDABLE_TABLES].sort());
    });
});
