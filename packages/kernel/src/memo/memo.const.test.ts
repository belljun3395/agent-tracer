import { describe, expect, expectTypeOf, it } from "vitest";
import type { MemoDto } from "./memo.dto.js";
import { MEMO_AUTHOR, MEMO_AUTHORS, type MemoAuthor } from "./memo.const.js";

describe("memo 계약 어휘", () => {
    it("저자 카탈로그를 외부 계약으로 고정한다", () => {
        expect(MEMO_AUTHORS).toEqual([MEMO_AUTHOR.human, MEMO_AUTHOR.agent]);
    });

    it("DTO 필드를 계약 어휘로 제한한다", () => {
        expectTypeOf<MemoDto["author"]>().toEqualTypeOf<MemoAuthor>();
    });
});
