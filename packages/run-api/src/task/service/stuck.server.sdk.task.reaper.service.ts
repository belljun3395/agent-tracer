import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import {
    RUNNING_TASK_STATUS,
    SERVER_SDK_TASK_ORIGIN,
} from "../common/task.status.const.js";
import { TaskQueryService } from "./task.query.service.js";
import { TaskLifecycleService } from "./task.lifecycle.service.js";

/**
 * Boot-time reaper for server-SDK tasks (Title Suggestion, Task Cleanup, Recipe
 * Scan, Rule Generation). Each spawns a short-lived Claude subprocess; if the
 * monitor is killed mid-run the SessionEnd hook never fires and the task row
 * stays `running` forever, which misleads the dashboard stats and blocks the
 * matching `findActiveForTask` lookups in the rule-gen / cleanup repositories.
 *
 * Runs once on startup as a module lifecycle hook (NOT orchestrated by the
 * gateway). Only server-SDK rows are eligible, so user-driven sessions that are
 * actually resuming elsewhere are left alone. Lives inside the task module so it
 * travels with the domain when split into its own service — each service fires
 * its own `OnApplicationBootstrap`.
 */
@Injectable()
export class StuckServerSdkTaskReaperService implements OnApplicationBootstrap {
    private readonly logger = new Logger(StuckServerSdkTaskReaperService.name);

    constructor(
        private readonly tasks: TaskQueryService,
        private readonly lifecycle: TaskLifecycleService,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        const active = await this.tasks.findAll("active");
        const stuck = active.filter(
            (t) => t.origin === SERVER_SDK_TASK_ORIGIN && t.status === RUNNING_TASK_STATUS,
        );
        if (stuck.length === 0) return;
        for (const task of stuck) {
            try {
                await this.lifecycle.finalizeTask({
                    taskId: task.id,
                    outcome: "errored",
                    summary: "Reaped on monitor restart — server-SDK task was left running.",
                    errorMessage: "monitor_restart_reaper",
                });
            } catch (err) {
                this.logger.error(
                    `reaper failed for task ${task.id}`,
                    err instanceof Error ? err.stack : String(err),
                );
            }
        }
        this.logger.warn(`reaped ${stuck.length} stuck server-sdk task(s) on boot`);
    }
}
