import "reflect-metadata";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { INestApplicationContext, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/index.js";
import { AppModule } from "../app.module.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "../database/database.provider.js";
import { BOOKMARKS_APPLICATION_EXPORTS } from "./bookmarks.providers.js";
import { BookmarksApplicationModule } from "./bookmarks-application.module.js";
import { EVENTS_APPLICATION_EXPORTS } from "./events.providers.js";
import { EventsApplicationModule } from "./events-application.module.js";
import { RULE_COMMANDS_APPLICATION_EXPORTS } from "./rule-commands.providers.js";
import { RuleCommandsApplicationModule } from "./rule-commands-application.module.js";
import { SESSIONS_APPLICATION_EXPORTS } from "./sessions.providers.js";
import { SessionsApplicationModule } from "./sessions-application.module.js";
import { SYSTEM_APPLICATION_EXPORTS } from "./system.providers.js";
import { SystemApplicationModule } from "./system-application.module.js";
import { TASK_APPLICATION_EXPORTS } from "./tasks.providers.js";
import { TasksApplicationModule } from "./tasks-application.module.js";
import { TURN_PARTITIONS_APPLICATION_EXPORTS } from "./turn-partitions.providers.js";
import { TurnPartitionsApplicationModule } from "./turn-partitions-application.module.js";
import { WORKFLOW_APPLICATION_EXPORTS } from "./workflow.providers.js";
import { WorkflowApplicationModule } from "./workflow-application.module.js";

type ProviderToken = Type<unknown> | string | symbol;

const featureApplicationModules = [
    {
        module: BookmarksApplicationModule,
        name: "bookmarks",
        exportedProviders: BOOKMARKS_APPLICATION_EXPORTS,
    },
    {
        module: EventsApplicationModule,
        name: "events",
        exportedProviders: EVENTS_APPLICATION_EXPORTS,
    },
    {
        module: RuleCommandsApplicationModule,
        name: "rule commands",
        exportedProviders: RULE_COMMANDS_APPLICATION_EXPORTS,
    },
    {
        module: SessionsApplicationModule,
        name: "sessions",
        exportedProviders: SESSIONS_APPLICATION_EXPORTS,
    },
    {
        module: SystemApplicationModule,
        name: "system",
        exportedProviders: SYSTEM_APPLICATION_EXPORTS,
    },
    {
        module: TasksApplicationModule,
        name: "tasks",
        exportedProviders: TASK_APPLICATION_EXPORTS,
    },
    {
        module: TurnPartitionsApplicationModule,
        name: "turn partitions",
        exportedProviders: TURN_PARTITIONS_APPLICATION_EXPORTS,
    },
    {
        module: WorkflowApplicationModule,
        name: "workflow",
        exportedProviders: WORKFLOW_APPLICATION_EXPORTS,
    },
] as const;

function providerName(token: ProviderToken): string {
    if (typeof token === "function") return token.name;
    return String(token);
}

describe("feature application modules", () => {
    let context: INestApplicationContext | undefined;
    let tempDir: string | undefined;

    afterEach(async () => {
        if (context) {
            const databaseContext = context.get<SqliteDatabaseContext>(SQLITE_DATABASE_CONTEXT_TOKEN);
            await context.close();
            databaseContext.close();
            context = undefined;
        }

        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
            tempDir = undefined;
        }

        vi.restoreAllMocks();
    });

    it("exports feature-owned providers through Nest DI", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        tempDir = await mkdtemp(path.join(os.tmpdir(), "agent-tracer-application-modules-"));
        context = await NestFactory.createApplicationContext(
            AppModule.forRoot({ databasePath: path.join(tempDir, "monitor.sqlite") }),
            { logger: false },
        );

        for (const featureModule of featureApplicationModules) {
            const moduleContext = context.select(featureModule.module);

            for (const provider of featureModule.exportedProviders) {
                expect(
                    moduleContext.get(provider as ProviderToken, { strict: true }),
                    `${featureModule.name} should export ${providerName(provider)}`,
                ).toBeDefined();
            }
        }
    });
});
