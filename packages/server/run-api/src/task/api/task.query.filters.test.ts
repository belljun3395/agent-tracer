import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
    parseListTasksArchivedScope,
    parseListTasksOriginFilter,
} from "./task.query.filters.js";

describe("task query filters — 목록 쿼리 파싱", () => {
    it("값이 없으면 기본 목록 필터를 반환한다", () => {
        expect(parseListTasksArchivedScope(undefined)).toBe("active");
        expect(parseListTasksOriginFilter(undefined)).toBe("all");
    });

    it("허용된 문자열만 typed filter로 반환한다", () => {
        expect(parseListTasksArchivedScope("archived")).toBe("archived");
        expect(parseListTasksOriginFilter("server-sdk")).toBe("server-sdk");
    });

    it("허용되지 않은 값이면 BadRequestException을 던진다", () => {
        expect(() => parseListTasksArchivedScope("deleted")).toThrow(BadRequestException);
        expect(() => parseListTasksOriginFilter("daemon")).toThrow(BadRequestException);
    });
});
