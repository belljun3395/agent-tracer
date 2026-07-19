import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { DEFAULT_USER_ID, TAGS_PATH } from "@monitor/kernel";
import { CreateTagUseCase } from "~tracer-api/domain/tag/application/command/create.tag.usecase.js";
import { DeleteTagUseCase } from "~tracer-api/domain/tag/application/command/delete.tag.usecase.js";
import { UpdateTagUseCase } from "~tracer-api/domain/tag/application/command/update.tag.usecase.js";
import { ListTagsUseCase } from "~tracer-api/domain/tag/application/query/list.tags.usecase.js";
import { TagController } from "./tag.controller.js";

Reflect.defineMetadata(
    "design:paramtypes",
    [ListTagsUseCase, CreateTagUseCase, UpdateTagUseCase, DeleteTagUseCase],
    TagController,
);

const listTags = { execute: vi.fn(async () => ({ items: [] })) };
const createTag = { execute: vi.fn(async () => ({ tag: { id: "t1" } })) };
const updateTag = { execute: vi.fn(async () => ({ tag: { id: "t1" } })) };
const deleteTag = { execute: vi.fn(async () => ({ deleted: true })) };

@Module({
    controllers: [TagController],
    providers: [
        { provide: ListTagsUseCase, useValue: listTags },
        { provide: CreateTagUseCase, useValue: createTag },
        { provide: UpdateTagUseCase, useValue: updateTag },
        { provide: DeleteTagUseCase, useValue: deleteTag },
    ],
})
class TestModule {}

describe("태그 HTTP 컨트롤러", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        listTags.execute.mockClear();
        createTag.execute.mockClear();
        updateTag.execute.mockClear();
        deleteTag.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    it("조회는 이 사용자의 태그 목록으로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TAGS_PATH}`);

        expect(res.status).toBe(200);
        expect(listTags.execute).toHaveBeenCalledWith(DEFAULT_USER_ID);
    });

    it("생성 요청 바디를 그대로 유스케이스에 전달하고 201을 낸다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TAGS_PATH}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "bug", color: "#d73a4a" }),
        });

        expect(res.status).toBe(201);
        expect(createTag.execute).toHaveBeenCalledWith({ userId: DEFAULT_USER_ID, name: "bug", color: "#d73a4a" });
    });

    it("알려지지 않은 필드가 섞인 생성 요청은 400으로 거부한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TAGS_PATH}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "bug", extra: "x" }),
        });

        expect(res.status).toBe(400);
    });

    it("수정 요청을 id와 바뀐 필드로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TAGS_PATH}/t1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ color: "#0e8a16" }),
        });

        expect(res.status).toBe(200);
        expect(updateTag.execute).toHaveBeenCalledWith({ userId: DEFAULT_USER_ID, id: "t1", color: "#0e8a16" });
    });

    it("삭제 요청을 id로 위임하고 200을 낸다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${TAGS_PATH}/t1`, { method: "DELETE" });

        expect(res.status).toBe(200);
        expect(deleteTag.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "t1");
    });
});
