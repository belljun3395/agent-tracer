import type { QueryRunner } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { InitLedger1783960000000 } from "./0001-InitLedger.js";
import { DisableLedgerPartitionRetention1784170000000 } from "./0002-DisableLedgerPartitionRetention.js";
import { RUNTIME_MIGRATIONS } from "./registry.js";

function recordingQueryRunner() {
    const query = vi.fn(async (_statement: string) => undefined);
    return { query, runner: { query } as unknown as QueryRunner };
}

describe("runtime ledger migrations", () => {
    it("초기 원장 다음에 안전 마이그레이션을 등록한다", () => {
        expect(RUNTIME_MIGRATIONS).toEqual([
            InitLedger1783960000000,
            DisableLedgerPartitionRetention1784170000000,
        ]);
    });

    it("새 스키마는 자동 보존 정책 없이 월별 파티션을 유지한다", async () => {
        const { query, runner } = recordingQueryRunner();

        await new InitLedger1783960000000().up(runner);

        const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
        expect(sql).toContain("partman.create_parent");
        expect(sql).toContain("p_interval := '1 month'");
        expect(sql).not.toMatch(/\bretention\s*=/i);
    });

    it("기존 스키마는 파티션 분리나 삭제 없이 자동 보존 정책을 비활성화한다", async () => {
        const { query, runner } = recordingQueryRunner();

        await new DisableLedgerPartitionRetention1784170000000().up(runner);

        expect(query).toHaveBeenCalledOnce();
        const sql = String(query.mock.calls[0]?.[0]);
        expect(sql).toMatch(/SET\s+retention\s*=\s*NULL/i);
        expect(sql).toMatch(/WHERE\s+parent_table\s*=\s*'public\.events'/i);
        expect(sql).not.toMatch(/detach|drop|undo_partition/i);
    });

    it("롤백해도 파괴적인 자동 보존 정책을 복원하지 않는다", async () => {
        const { query, runner } = recordingQueryRunner();

        await new DisableLedgerPartitionRetention1784170000000().down(runner);

        expect(query).not.toHaveBeenCalled();
    });
});
