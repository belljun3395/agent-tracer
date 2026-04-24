import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { pathParamPipe } from "./path-param.pipe.js";

describe("pathParamPipe", () => {
    it("passes non-blank path parameters through", () => {
        expect(pathParamPipe.transform("task-1", { type: "param" })).toBe("task-1");
    });

    it("rejects blank path parameters", () => {
        expect(() => pathParamPipe.transform("   ", { type: "param" })).toThrow(BadRequestException);
        try {
            pathParamPipe.transform("   ", { type: "param" });
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).getResponse()).toMatchObject({
                ok: false,
                error: {
                    code: "validation_error",
                    message: "Invalid path parameter",
                    details: expect.any(Object),
                },
            });
        }
    });
});
