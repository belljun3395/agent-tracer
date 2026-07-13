import {describe, expect, it} from "vitest";
import {
    captureTerminalToolResponse,
    captureToolResultBody,
} from "~runtime/domain/ingest/model/tool.capture.model.js";

describe("captureTerminalToolResponse", () => {
    it("구조화된 응답의 별칭 필드와 자르기 전 바이트 수를 보존한다", () => {
        expect(captureTerminalToolResponse({
            exit_code: 3,
            output: "표준 출력",
            stderr: "표준 오류",
            wasInterrupted: true,
        })).toEqual({
            exitCode: 3,
            interrupted: true,
            stdout: "표준 출력",
            stdoutBytes: 13,
            stderr: "표준 오류",
            stderrBytes: 13,
        });
    });

    it("문자열로 온 도구 응답을 stdout으로 받아 원장에 남긴다", () => {
        expect(captureTerminalToolResponse("빌드 완료")).toEqual({
            stdout: "빌드 완료",
            stdoutBytes: 13,
        });
    });

    it("객체도 문자열도 아닌 응답은 비어 있는 캡처로 처리한다", () => {
        expect(captureTerminalToolResponse(undefined)).toEqual({});
        expect(captureTerminalToolResponse([1, 2])).toEqual({});
    });
});

describe("captureToolResultBody", () => {
    it("객체 결과를 JSON으로 직렬화하고 결과 건수를 함께 보존한다", () => {
        expect(captureToolResultBody({items: [1, 2]}, {matchCounter: () => 2})).toEqual({
            resultText: '{"items":[1,2]}',
            resultBytes: 15,
            resultMatches: 2,
        });
    });

    it("직렬화할 수 없는 결과는 비어 있는 캡처로 처리한다", () => {
        const cyclic: Record<string, unknown> = {};
        cyclic["self"] = cyclic;

        expect(captureToolResultBody(cyclic)).toEqual({});
    });
});
