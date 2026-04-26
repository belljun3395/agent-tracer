import type { TaskUpsertPortDto } from "~application/ports/tasks/dto/task.upsert.port.dto.js";
import type { TaskOverviewQueryPort } from "~application/ports/tasks/task.overview.query.port.js";
import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TaskWritePort } from "~application/ports/tasks/task.write.port.js";

export type TaskUpsertInput = TaskUpsertPortDto;

export interface ITaskRepository extends TaskReadPort, TaskWritePort, TaskOverviewQueryPort {}
