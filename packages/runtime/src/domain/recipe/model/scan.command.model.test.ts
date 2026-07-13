import {describe, expect, it} from "vitest";
import {hasRecipeScanCommand, readRecipeScanIntent} from "~runtime/domain/recipe/model/scan.command.model.js";

describe("hasRecipeScanCommand", () => {
    it("플러그인 네임스페이스가 붙은 명령도 인식한다", () => {
        expect(hasRecipeScanCommand("/recipe")).toBe(true);
        expect(hasRecipeScanCommand("/agent-tracer-monitor:recipe 배포")).toBe(true);
        expect(hasRecipeScanCommand("$recipe 배포")).toBe(true);
    });

    it("접두사만 같은 다른 명령과 평문은 인식하지 않는다", () => {
        expect(hasRecipeScanCommand("/recipes")).toBe(false);
        expect(hasRecipeScanCommand("레시피를 만들어줘")).toBe(false);
    });
});

describe("readRecipeScanIntent", () => {
    it("명령 뒤에 남은 텍스트를 의도로 읽는다", () => {
        expect(readRecipeScanIntent("/recipe 인증 흐름만 뽑아줘")).toBe("인증 흐름만 뽑아줘");
        expect(readRecipeScanIntent("/agent-tracer-monitor:recipe 배포 절차")).toBe("배포 절차");
    });

    it("인자가 없거나 명령이 아니면 의도가 없다", () => {
        expect(readRecipeScanIntent("/recipe   ")).toBeUndefined();
        expect(readRecipeScanIntent("레시피")).toBeUndefined();
    });
});
