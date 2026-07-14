import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { searchEvents, type RecipeSearchClient } from "./recipe.search.js";

// 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const CONTRACT = JSON.parse(
    readFileSync(
        new URL("../../../../../../../kernel/src/agent/__fixtures__/recipe.scan.tool.contract.json", import.meta.url),
        "utf8",
    ),
) as {
    readonly tools: Readonly<
        Record<string, { readonly responseEvent?: { readonly required: string[]; readonly optional: string[] } }>
    >;
};

function hit(id: string, taskId: string): Record<string, unknown> {
    return {
        _id: id,
        _source: {
            taskId,
            seq: 7,
            kind: "agent_tracer.user.message",
            title: "migration fails",
            body: "the migration failed again",
            toolName: "Bash",
            filePaths: ["src/app.ts"],
            occurredAt: "2026-01-01T00:00:00.000Z",
        },
    };
}

function clientReturning(hits: readonly Record<string, unknown>[]): RecipeSearchClient {
    return {
        search: () => Promise.resolve({ hits: { total: { value: hits.length }, hits } }),
    };
}

describe("search_events", () => {
    it("모델에게 돌려주는 이벤트 본문이 골든 계약과 같다", async () => {
        const contract = CONTRACT.tools["search_events"]?.responseEvent;

        const page = await searchEvents(
            clientReturning([hit("event-1", "task-1")]),
            "user-1",
            { q: "migration" },
            20,
            0,
            new ProvenanceLedger(),
        );

        expect(new Set(Object.keys(page.events[0] ?? {}))).toEqual(
            new Set([...contract!.required, ...contract!.optional]),
        );
    });

    it("taskId 필터 없이 검색해도 각 이벤트가 자기 taskId를 싣고 돌아온다", async () => {
        const page = await searchEvents(
            clientReturning([hit("event-1", "task-1"), hit("event-2", "task-2")]),
            "user-1",
            { q: "migration" },
            20,
            0,
            new ProvenanceLedger(),
        );

        expect(page.events.map((event) => event.taskId)).toEqual(["task-1", "task-2"]);
    });

    it("taskId 필터 없이 찾은 이벤트도 태스크별 근거 장부에 오른다", async () => {
        const ledger = new ProvenanceLedger();

        await searchEvents(
            clientReturning([hit("event-1", "task-1"), hit("event-2", "task-2")]),
            "user-1",
            { q: "migration" },
            20,
            0,
            ledger,
        );

        expect(ledger.snapshot().eventIdsByTask).toEqual({
            "task-1": ["event-1"],
            "task-2": ["event-2"],
        });
    });
});
