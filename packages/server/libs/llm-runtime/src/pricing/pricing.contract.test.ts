import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODEL_RATES } from "./pricing.js";

// 두 언어가 같은 파일을 읽어야 한쪽만 바뀌는 드리프트가 남지 않는다.
const GOLDEN = new URL(
    "../../../../../../packages/kernel/src/agent/__fixtures__/model.pricing.json",
    import.meta.url,
);

describe("모델 단가", () => {
    it("골든 계약과 같은 단가를 쓴다", () => {
        const contract = JSON.parse(readFileSync(GOLDEN, "utf8")) as {
            rates: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }>;
        };

        expect(Object.fromEntries(MODEL_RATES)).toEqual(contract.rates);
    });
});
