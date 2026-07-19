import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { DEFAULT_USER_ID, TASK_TAGS_PATH } from "@monitor/kernel";
import { SetTaskTagsUseCase } from "~tracer-api/domain/tag/application/command/set.task.tags.usecase.js";
import { GetTaskTagsUseCase } from "~tracer-api/domain/tag/application/query/get.task.tags.usecase.js";
import { GetTasksByTagUseCase } from "~tracer-api/domain/tag/application/query/get.tasks.by.tag.usecase.js";
import { TaskTagController } from "./task.tag.controller.js";

Reflect.defineMetadata(
    "design:paramtypes",
    [GetTaskTagsUseCase, GetTasksByTagUseCase, SetTaskTagsUseCase],
    TaskTagController,
);

const getTaskTags = { execute: vi.fn(async () => ({ taskId: "task-1", tags: [] })) };
const getTasksByTag = { execute: vi.fn(async () => ({ tagId: "tag-1", taskIds: [] })) };
const setTaskTags = { execute: vi.fn(async () => ({ taskId: "task-1", tags: [] })) };

@Module({
    controllers: [TaskTagController],
    providers: [
        { provide: GetTaskTagsUseCase, useValue: getTaskTags },
        { provide: GetTasksByTagUseCase, useValue: getTasksByTag },
        { provide: SetTaskTagsUseCase, useValue: setTaskTags },
    ],
})
class TestModule {}

describe("태스크·태그 HTTP 컨트롤러", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        getTaskTags.execute.mockClear();
        getTasksByTag.execute.mockClear();
        setTaskTags.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    it("taskId로 조회하면 그 태스크의 태그 조회로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TASK_TAGS_PATH}?taskId=task-1`);

        expect(res.status).toBe(200);
        expect(getTaskTags.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "task-1");
        expect(getTasksByTag.execute).not.toHaveBeenCalled();
    });

    it("tagId로 조회하면 그 태그가 붙은 태스크 조회로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TASK_TAGS_PATH}?tagId=tag-1`);

        expect(res.status).toBe(200);
        expect(getTasksByTag.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "tag-1");
        expect(getTaskTags.execute).not.toHaveBeenCalled();
    });

    it("taskId와 tagId를 둘 다 주면 400으로 거부한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TASK_TAGS_PATH}?taskId=task-1&tagId=tag-1`);

        expect(res.status).toBe(400);
    });

    it("taskId와 tagId를 둘 다 주지 않으면 400으로 거부한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TASK_TAGS_PATH}`);

        expect(res.status).toBe(400);
    });

    it("치환 요청 바디를 그대로 유스케이스에 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TASK_TAGS_PATH}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ taskId: "task-1", tagIds: ["tag-a", "tag-b"] }),
        });

        expect(res.status).toBe(200);
        expect(setTaskTags.execute).toHaveBeenCalledWith({ userId: DEFAULT_USER_ID, taskId: "task-1", tagIds: ["tag-a", "tag-b"] });
    });
});
