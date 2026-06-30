import { Injectable } from "@nestjs/common";
import type { ITaskMaintenance } from "../../public/task/iservice/task.maintenance.iservice.js";
import { ArchiveTaskUseCase } from "./archive.task.usecase.js";
import { LinkTaskUseCase } from "./link.task.usecase.js";
import { ReslugTaskUseCase } from "./reslug.task.usecase.js";
import { UpdateTaskUseCase } from "./update.task.usecase.js";

/** TASK_MAINTENANCE 발행 계약 구현. */
@Injectable()
export class TaskMaintenanceFacade implements ITaskMaintenance {
    constructor(
        private readonly archiveTask: ArchiveTaskUseCase,
        private readonly updateTask: UpdateTaskUseCase,
        private readonly linkTask: LinkTaskUseCase,
        private readonly reslugTask: ReslugTaskUseCase,
    ) {}

    async archive(taskId: string): Promise<void> {
        await this.archiveTask.execute({ taskId });
    }

    async rename(taskId: string, title: string): Promise<boolean> {
        const out = await this.updateTask.execute({ taskId, title });
        return out != null;
    }

    async link(taskId: string, parentTaskId: string): Promise<void> {
        await this.linkTask.execute({ taskId, parentTaskId });
    }

    async reslug(
        taskId: string,
        slug: string,
    ): Promise<{ readonly status: "reslugged" | "not_found" }> {
        return this.reslugTask.execute({ taskId, slug });
    }
}
