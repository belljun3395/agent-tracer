import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { COMPLETED_TASK_STATUS, MONITOR_USER_HEADER } from "@monitor/kernel";
import type { INestApplication } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchiveTaskUseCase } from "~tracer-api/domain/task/application/command/archive.task.usecase.js";
import { HideTaskUseCase } from "~tracer-api/domain/task/application/command/hide.task.usecase.js";
import { RenameTaskUseCase } from "~tracer-api/domain/task/application/command/rename.task.usecase.js";
import { SetTaskStatusUseCase } from "~tracer-api/domain/task/application/command/set.task.status.usecase.js";
import { UnarchiveTaskUseCase } from "~tracer-api/domain/task/application/command/unarchive.task.usecase.js";
import { ExportOpenInferenceUseCase } from "~tracer-api/domain/task/application/export/export.openinference.usecase.js";
import { GetTaskUseCase } from "~tracer-api/domain/task/application/query/get.task.usecase.js";
import { ListChildTasksUseCase } from "~tracer-api/domain/task/application/query/list.child.tasks.usecase.js";
import { ListTaskUserInputsUseCase } from "~tracer-api/domain/task/application/query/list.task.user.inputs.usecase.js";
import { ListTasksUseCase } from "~tracer-api/domain/task/application/query/list.tasks.usecase.js";
import { ListTurnsUseCase } from "~tracer-api/domain/task/application/query/list.turns.usecase.js";
import { TaskActivityController } from "./task.activity.controller.js";
import { TaskCommandController } from "./task.command.controller.js";
import { TaskExportController } from "./task.export.controller.js";
import { TaskQueryController } from "./task.query.controller.js";

Reflect.defineMetadata(
    "design:paramtypes",
    [ListTasksUseCase, GetTaskUseCase, ListChildTasksUseCase],
    TaskQueryController,
);
Reflect.defineMetadata(
    "design:paramtypes",
    [ListTurnsUseCase, ListTaskUserInputsUseCase],
    TaskActivityController,
);
Reflect.defineMetadata("design:paramtypes", [ExportOpenInferenceUseCase], TaskExportController);
Reflect.defineMetadata(
    "design:paramtypes",
    [RenameTaskUseCase, SetTaskStatusUseCase, ArchiveTaskUseCase, UnarchiveTaskUseCase, HideTaskUseCase],
    TaskCommandController,
);

const listTasks = { execute: vi.fn(async () => ({ items: [], nextCursor: null })) };
const renameTask = { execute: vi.fn(async () => ({ title: "새 제목" })) };
const setTaskStatus = { execute: vi.fn(async () => ({ status: COMPLETED_TASK_STATUS })) };

@Module({
    controllers: [TaskQueryController, TaskActivityController, TaskExportController, TaskCommandController],
    providers: [
        { provide: ListTasksUseCase, useValue: listTasks },
        { provide: GetTaskUseCase, useValue: { execute: vi.fn() } },
        { provide: ListTurnsUseCase, useValue: { execute: vi.fn() } },
        { provide: ListTaskUserInputsUseCase, useValue: { execute: vi.fn() } },
        { provide: ListChildTasksUseCase, useValue: { execute: vi.fn() } },
        { provide: ExportOpenInferenceUseCase, useValue: { execute: vi.fn() } },
        { provide: RenameTaskUseCase, useValue: renameTask },
        { provide: SetTaskStatusUseCase, useValue: setTaskStatus },
        { provide: ArchiveTaskUseCase, useValue: { execute: vi.fn() } },
        { provide: UnarchiveTaskUseCase, useValue: { execute: vi.fn() } },
        { provide: HideTaskUseCase, useValue: { execute: vi.fn() } },
    ],
})
class TestModule {}

describe("태스크 HTTP 컨트롤러", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        listTasks.execute.mockClear();
        renameTask.execute.mockClear();
        setTaskStatus.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    it("목록 쿼리를 사용자 범위 조회 조건으로 변환한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const response = await fetch(
            `${await app.getUrl()}/api/v1/tasks?archived=false&root=true&parentTaskId=parent-1&cursor=next&limit=7`,
            { headers: { [MONITOR_USER_HEADER]: "user-1" } },
        );

        expect(response.status).toBe(200);
        expect(listTasks.execute).toHaveBeenCalledWith({
            userId: "user-1",
            archived: false,
            rootOnly: true,
            parentTaskId: "parent-1",
            cursor: "next",
            limit: 7,
        });
    });

    it("제목과 상태 수정 요청을 각각의 명령으로 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const response = await fetch(`${await app.getUrl()}/api/v1/tasks/task-1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: "새 제목", status: COMPLETED_TASK_STATUS }),
        });

        expect(response.status).toBe(200);
        expect(renameTask.execute).toHaveBeenCalledWith("task-1", "새 제목", "user");
        expect(setTaskStatus.execute).toHaveBeenCalledWith("task-1", COMPLETED_TASK_STATUS);
        await expect(response.json()).resolves.toEqual({
            taskId: "task-1",
            title: "새 제목",
            status: COMPLETED_TASK_STATUS,
        });
    });

    it("titleRank을 명시하면 그 순위를 개명 명령에 그대로 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const response = await fetch(`${await app.getUrl()}/api/v1/tasks/task-1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: "에이전트 제목", titleRank: "agent" }),
        });

        expect(response.status).toBe(200);
        expect(renameTask.execute).toHaveBeenCalledWith("task-1", "에이전트 제목", "agent");
    });
});
