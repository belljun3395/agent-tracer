import { z } from "zod";

// OTLP AnyValue: int64 is serialised as a string in JSON to avoid precision loss.
const otlpAnyValue = z.union([
    z.object({ stringValue: z.string() }),
    z.object({ intValue: z.union([z.string(), z.number()]) }),
    z.object({ doubleValue: z.number() }),
    z.object({ boolValue: z.boolean() }),
    z.record(z.unknown()),
]);

const otlpKeyValue = z.object({
    key: z.string(),
    value: otlpAnyValue,
});

const otlpLogRecord = z.object({
    timeUnixNano: z.string().optional(),
    body: otlpAnyValue.optional(),
    attributes: z.array(otlpKeyValue).default([]),
});

const otlpScopeLogs = z.object({
    scope: z.object({ name: z.string().optional() }).optional(),
    logRecords: z.array(otlpLogRecord).default([]),
});

const otlpResourceLogs = z.object({
    resource: z.object({
        attributes: z.array(otlpKeyValue).default([]),
    }).optional(),
    scopeLogs: z.array(otlpScopeLogs).default([]),
});

export const otlpLogsRequestSchema = z.object({
    resourceLogs: z.array(otlpResourceLogs).default([]),
});

export type OtlpLogsRequest = z.infer<typeof otlpLogsRequestSchema>;
export type OtlpKeyValue = z.infer<typeof otlpKeyValue>;
export type OtlpLogRecord = z.infer<typeof otlpLogRecord>;
