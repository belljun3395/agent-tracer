import { BadRequestException, Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { ZodError, ZodType, ZodTypeDef } from "zod";

export interface ValidationErrorBody {
    readonly ok: false;
    readonly error: {
        readonly code: "validation_error";
        readonly message: string;
        readonly details: ReturnType<ZodError["format"]>;
    };
}

export function createValidationErrorBody(error: ZodError, message = "Invalid request"): ValidationErrorBody {
    return {
        ok: false,
        error: {
            code: "validation_error",
            message,
            details: error.format(),
        },
    };
}

@Injectable()
export class ZodValidationPipe<TOutput = unknown> implements PipeTransform<unknown, TOutput> {
    constructor(
        private readonly schema: ZodType<TOutput, ZodTypeDef, unknown>,
        private readonly message = "Invalid request",
    ) {}

    transform(value: unknown, _metadata: ArgumentMetadata): TOutput {
        const parsed = this.schema.safeParse(value);
        if (parsed.success) return parsed.data;
        throw new BadRequestException(createValidationErrorBody(parsed.error, this.message));
    }
}
