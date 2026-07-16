import {describe, expect, it} from "vitest";
import {isSystemNotificationPrompt} from "~runtime/domain/ingest/model/system.notification.model.js";

describe("isSystemNotificationPrompt", () => {
    it("<task-notification>으로 시작하는 프롬프트를 시스템 알림으로 본다", () => {
        expect(isSystemNotificationPrompt("<task-notification>백그라운드 작업이 끝났다</task-notification>"))
            .toBe(true);
    });

    it("앞에 공백이 있어도 트림 후 접두어를 확인한다", () => {
        expect(isSystemNotificationPrompt("  \n<task-notification>done</task-notification>")).toBe(true);
    });

    it("사용자가 직접 쓴 발화는 시스템 알림이 아니다", () => {
        expect(isSystemNotificationPrompt("lint 좀 돌려줘")).toBe(false);
    });

    it("접두어가 문장 중간에 있으면 시스템 알림으로 보지 않는다", () => {
        expect(isSystemNotificationPrompt("이 텍스트는 <task-notification>을 언급만 한다")).toBe(false);
    });

    it("빈 프롬프트는 시스템 알림이 아니다", () => {
        expect(isSystemNotificationPrompt("")).toBe(false);
    });
});
