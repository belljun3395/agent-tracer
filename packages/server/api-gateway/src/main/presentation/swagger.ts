import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

export const API_DOCS_PATH = "api/docs";

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
