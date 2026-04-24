import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { Request } from "express";
import { createApiSuccessEnvelope, isApiResponsePath, type ApiSuccessEnvelope } from "./api-response-envelope.js";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessEnvelope | unknown> {
        if (context.getType() !== "http") {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest<Request>();
        const pathname = request.path || request.originalUrl || request.url;
        if (!isApiResponsePath(pathname)) {
            return next.handle();
        }

        return next.handle().pipe(map((payload: unknown) => createApiSuccessEnvelope(payload)));
    }
}
