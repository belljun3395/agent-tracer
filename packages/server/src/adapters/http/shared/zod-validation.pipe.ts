import { BadRequestException, Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { ZodError, ZodType, ZodTypeDef } from "zod";
import {
    createApiErrorEnvelope,
    type ApiErrorEnvelope,
} from "~adapters/http/shared/api-response-envelope.js";

function createValidationErrorBody(error: ZodError, message = "Invalid request"): ApiErrorEnvelope {
    return createApiErrorEnvelope("validation_error", message, error.format());
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
