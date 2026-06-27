import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

describe("ZodValidationPipe", () => {
    it("returns parsed values", () => {
        const pipe = new ZodValidationPipe(z.object({ limit: z.coerce.number().int() }));

        expect(pipe.transform({ limit: "10" }, { type: "query" })).toEqual({ limit: 10 });
    });

    it("throws a consistent validation response", () => {
        const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

        expect(() => pipe.transform({ name: "" }, { type: "body" })).toThrow(BadRequestException);
        try {
            pipe.transform({ name: "" }, { type: "body" });
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).getResponse()).toMatchObject({
                ok: false,
                error: {
                    code: "validation_error",
                    message: "Invalid request",
                    details: expect.any(Object),
                },
            });
        }
    });
});
