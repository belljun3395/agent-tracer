import type { TaskOverviewQueryPort, TaskReadPort, TaskUpsertPortDto, TaskWritePort } from "../tasks/index.js";

export type TaskUpsertInput = TaskUpsertPortDto;

export interface ITaskRepository extends TaskReadPort, TaskWritePort, TaskOverviewQueryPort {}
