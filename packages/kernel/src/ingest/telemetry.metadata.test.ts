import { describe, expect, it } from "vitest";
import { KIND } from "./event.kind.const.js";
import { payloadSchemaByKind } from "./ingest.schema.js";

describe("telemetry payload metadata", () => {
    it("token.usage의 모델과 컨텍스트 metadata를 보존한다", () => {
        const parsed = payloadSchemaByKind[KIND.tokenUsage]!.parse({
            inputTokens: 10,
            outputTokens: 2,
            model: "gpt-5.6-sol",
            metadata: {
                model: "gpt-5.6-sol",
                contextWindowTotalTokens: 12,
                contextWindowSize: 353_400,
            },
        });

        expect(parsed).toMatchObject({
            model: "gpt-5.6-sol",
            metadata: {
                model: "gpt-5.6-sol",
                contextWindowTotalTokens: 12,
                contextWindowSize: 353_400,
            },
        });
    });
});
