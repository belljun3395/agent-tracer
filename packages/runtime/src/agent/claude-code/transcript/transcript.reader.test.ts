import {describe, expect, it} from "vitest";
import {parseJsonLine} from "~runtime/agent/claude-code/transcript/transcript.reader.js";

describe("parseJsonLine", () => {
    it("JSON 객체 한 줄을 레코드로 읽는다", () => {
        expect(parseJsonLine('{"session_id":"s-1"}')).toEqual({session_id: "s-1"});
    });

    it("앞뒤 공백을 무시하고 파싱한다", () => {
        expect(parseJsonLine('  {"type":"user"}  ')).toEqual({type: "user"});
    });

    it("빈 줄은 null이다", () => {
        expect(parseJsonLine("   ")).toBeNull();
    });

    it("깨진 JSON은 null이다", () => {
        expect(parseJsonLine("{not json")).toBeNull();
    });

    it("객체가 아닌 JSON은 null이다", () => {
        expect(parseJsonLine("[1,2,3]")).toBeNull();
        expect(parseJsonLine("42")).toBeNull();
    });
});
