import { z } from "zod";

const dbSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive().max(65535),
    username: z.string().min(1),
    password: z.string(),
    database: z.string().min(1),
});

export const applicationConfigSchema = z.object({
    profile: z.enum(["local", "prd"]),
    runtimeApi: z.object({ port: z.number().int().positive().max(65535) }),
    tracerApi: z.object({ port: z.number().int().positive().max(65535) }),
    projector: z.object({ port: z.number().int().positive().max(65535) }),
    listenHost: z.string().min(1),
    runtimeDb: dbSchema,
    tracerDb: dbSchema,
    kafka: z.object({ brokers: z.array(z.string().min(1)).min(1) }),
    opensearch: z.object({ node: z.string().min(1) }),
    temporal: z.object({ address: z.string().min(1), namespace: z.string().min(1) }),
    agentGraph: z.object({
        url: z.string().min(1),
        toolCallbackPort: z.number().int().positive(),
        toolCallbackUrl: z.string().min(1),
        instanceId: z.string().min(1),
    }),
    coldStore: z.object({
        endpoint: z.string().min(1),
        region: z.string().min(1),
        bucket: z.string().min(1),
        prefix: z.string(),
        accessKey: z.string().min(1),
        secretKey: z.string(),
        useSsl: z.boolean(),
    }),
    tiering: z.object({ duckdbBin: z.string().min(1) }),
});

export type ApplicationConfig = z.infer<typeof applicationConfigSchema>;
export type DbConfig = z.infer<typeof dbSchema>;
