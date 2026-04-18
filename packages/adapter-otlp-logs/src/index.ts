import "reflect-metadata";
import { MonitorService } from "@monitor/application";
import { OtlpLogsController } from "./otlp-logs.controller.js";

export type { OtlpLogsRequest, OtlpKeyValue, OtlpLogRecord } from "./schemas.otlp.js";
export type { OtlpApiRequestRecord } from "./otlp-mapper.js";
export { extractApiRequestRecords } from "./otlp-mapper.js";
export { OtlpLogsController } from "./otlp-logs.controller.js";

export const otlpControllers = [OtlpLogsController] as const;

function setParamTypes(target: object, ...types: unknown[]) {
    Reflect.defineMetadata("design:paramtypes", types, target);
}

export function registerOtlpControllerMetadata(serviceToken: unknown = MonitorService): void {
    for (const ctrl of otlpControllers) {
        setParamTypes(ctrl, serviceToken);
    }
}
