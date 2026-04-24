import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { NO_ENVELOPE_METADATA_KEY } from "../decorators/no-envelope.decorator.js";
import { createApiSuccessEnvelope, type ApiSuccessEnvelope } from "./api-response-envelope.js";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
    constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessEnvelope | unknown> {
        if (context.getType() !== "http") {
            return next.handle();
        }

        const skip = this.reflector.getAllAndOverride<boolean | undefined>(
            NO_ENVELOPE_METADATA_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (skip) {
            return next.handle();
        }

        return next.handle().pipe(map((payload: unknown) => createApiSuccessEnvelope(payload)));
    }
}
