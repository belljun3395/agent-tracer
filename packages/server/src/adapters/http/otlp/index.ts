import "reflect-metadata";

export type { OtlpLogsRequest, OtlpKeyValue, OtlpLogRecord } from "./schemas/otlp.logs.schema.js";
export type { OtlpApiRequestRecord } from "./mappers/otlp.mapper.js";
export { extractApiRequestRecords } from "./mappers/otlp.mapper.js";
export { OtlpLogsController } from "./controllers/otlp.logs.controller.js";
