import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

/** Path the Swagger UI + JSON are served from. */
export const API_DOCS_PATH = "api/docs";

/**
 * Mounts the OpenAPI document + Swagger UI. Request bodies/queries are typed
 * with `nestjs-zod` `createZodDto` classes, so their schemas are derived from
 * the same Zod definitions the {@link ZodValidationPipe} validates against;
 * `cleanupOpenApiDoc` post-processes the nestjs-zod metadata into a valid spec.
 *
 * Disabled by setting MONITOR_ENABLE_API_DOCS=0 (e.g. for a network-exposed
 * deployment that should not advertise its API surface).
 */
export function setupSwagger(app: INestApplication, path: string = API_DOCS_PATH): void {
    if (process.env.MONITOR_ENABLE_API_DOCS === "0") return;
    const config = new DocumentBuilder()
        .setTitle("Agent Tracer Monitor API")
        .setDescription("HTTP query/command + runtime ingest API for the Agent Tracer monitor server.")
        .setVersion("0.1.0")
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(path, app, cleanupOpenApiDoc(document));
}
