import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestContextIncomingMessage } from "../middleware/request-context.js";

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestContextIncomingMessage>();
    return request.requestId;
});

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestContextIncomingMessage>();
    return request.clientIp;
});
