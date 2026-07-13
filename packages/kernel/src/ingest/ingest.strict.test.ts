import { describe, expect, it } from "vitest";
import { parseIngestBatch } from "./ingest.schema.js";
import { KIND } from "./event.kind.const.js";

const envelope = {
    id: "01KX8J58W3QW80WMZ75VP5DMQN",
    kind: KIND.fileChanged,
    taskId: "t1",
    occurredAt: "2026-07-11T00:00:00.000Z",
};

function parse(payload: Record<string, unknown>) {
    return parseIngestBatch({ contractVersion: "0.5.0", events: [{ ...envelope, payload }] });
}

describe("인제스트 strict 드리프트 방어", () => {
    it("스키마가 아는 키만 담은 이벤트는 통과한다", () => {
        const result = parse({ title: "파일 변경", lane: "background", metadata: {}, filePaths: ["a.ts"] });

        expect(result.rejected).toEqual([]);
        expect(result.accepted).toHaveLength(1);
    });

    it("스키마가 모르는 키는 조용히 삭제하지 않고 레코드를 거부한다", () => {
        const result = parse({ title: "파일 변경", lane: "background", metadata: {}, bogusKey: "drift" });

        expect(result.accepted).toHaveLength(0);
        expect(result.rejected[0]?.reason).toContain("bogusKey");
    });

    it("거부는 배치 전체가 아니라 레코드 단위로 일어난다", () => {
        const result = parseIngestBatch({
            contractVersion: "0.5.0",
            events: [
                { ...envelope, payload: { title: "정상", lane: "background", metadata: {} } },
                { ...envelope, id: "01KX8J58W3QW80WMZ75VP5DMQP", payload: { title: "드리프트", lane: "background", metadata: {}, bogusKey: "x" } },
            ],
        });

        expect(result.accepted).toHaveLength(1);
        expect(result.rejected).toHaveLength(1);
    });
});
