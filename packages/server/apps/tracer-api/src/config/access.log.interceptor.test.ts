import { describe, expect, it, vi } from "vitest";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { AccessLogInterceptor } from "./access.log.interceptor.js";

function contextOf(request: unknown, response: unknown, type = "http"): ExecutionContext {
    return {
        getType: () => type,
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext;
}

function fakeResponse(statusCode: number): { statusCode: number; once: (event: string, cb: () => void) => void; finish: () => void } {
    let onFinish: (() => void) | undefined;
    return {
        statusCode,
        once: (event, cb) => {
            if (event === "finish") onFinish = cb;
        },
        finish: () => onFinish?.(),
    };
}

const passthrough: CallHandler = { handle: () => of(null) };

function lastLoggedLine(write: { readonly mock: { readonly calls: readonly unknown[][] } }): Record<string, unknown> {
    const call = write.mock.calls.at(-1);
    return JSON.parse((call![0] as string).trim()) as Record<string, unknown>;
}

describe("AccessLogInterceptor", () => {
    it("응답이 끝나면 매칭된 라우트 패턴과 상태와 소요시간을 한 줄로 남긴다", () => {
        const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const interceptor = new AccessLogInterceptor();
        const request = {
            method: "GET",
            path: "/tasks/abc123",
            route: { path: "/:id" },
            baseUrl: "/tasks",
            headers: { [MONITOR_USER_HEADER]: "user-1" },
        };
        const response = fakeResponse(200);

        interceptor.intercept(contextOf(request, response), passthrough).subscribe();
        response.finish();

        const line = lastLoggedLine(write);
        expect(line).toMatchObject({
            level: "info",
            msg: "http.request.completed",
            method: "GET",
            route: "/tasks/:id",
            status: 200,
            userId: "user-1",
        });
        expect(typeof line["durationMs"]).toBe("number");
        write.mockRestore();
    });

    it("HTTP 밖의 요청은 관측하지 않고 그대로 통과시킨다", () => {
        const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const interceptor = new AccessLogInterceptor();
        const context = {
            getType: () => "ws",
            switchToHttp: () => {
                throw new Error("http 컨텍스트가 아니면 요청을 읽지 않는다");
            },
        } as unknown as ExecutionContext;

        interceptor.intercept(context, passthrough).subscribe();

        expect(write).not.toHaveBeenCalled();
        write.mockRestore();
    });

    it("매칭된 라우트가 없으면 원시 path로 대체하고 사용자 헤더가 없으면 undefined를 남긴다", () => {
        const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const interceptor = new AccessLogInterceptor();
        const request = { method: "GET", path: "/health", headers: {} };
        const response = fakeResponse(204);

        interceptor.intercept(contextOf(request, response), passthrough).subscribe();
        response.finish();

        const line = lastLoggedLine(write);
        expect(line["route"]).toBe("/health");
        expect(line["userId"]).toBeUndefined();
        write.mockRestore();
    });
});
