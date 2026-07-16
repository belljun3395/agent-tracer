import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { DEFAULT_USER_ID, MEMOS_PATH } from "@monitor/kernel";
import { CreateMemoUseCase } from "~tracer-api/domain/memo/application/command/create.memo.usecase.js";
import { DeleteMemoUseCase } from "~tracer-api/domain/memo/application/command/delete.memo.usecase.js";
import { UpdateMemoUseCase } from "~tracer-api/domain/memo/application/command/update.memo.usecase.js";
import { GetMemosByTaskUseCase } from "~tracer-api/domain/memo/application/query/get.memos.by.task.usecase.js";
import { ListMemosUseCase } from "~tracer-api/domain/memo/application/query/list.memos.usecase.js";
import { MemoController } from "./memo.controller.js";

Reflect.defineMetadata(
    "design:paramtypes",
    [ListMemosUseCase, GetMemosByTaskUseCase, CreateMemoUseCase, UpdateMemoUseCase, DeleteMemoUseCase],
    MemoController,
);

const listMemos = { execute: vi.fn(async () => ({ items: [] })) };
const getMemosByTask = { execute: vi.fn(async () => ({ items: [] })) };
const createMemo = { execute: vi.fn(async () => ({ memo: { id: "m1" } })) };
const updateMemo = { execute: vi.fn(async () => ({ memo: { id: "m1" } })) };
const deleteMemo = { execute: vi.fn(async () => ({ deleted: true })) };

@Module({
    controllers: [MemoController],
    providers: [
        { provide: ListMemosUseCase, useValue: listMemos },
        { provide: GetMemosByTaskUseCase, useValue: getMemosByTask },
        { provide: CreateMemoUseCase, useValue: createMemo },
        { provide: UpdateMemoUseCase, useValue: updateMemo },
        { provide: DeleteMemoUseCase, useValue: deleteMemo },
    ],
})
class TestModule {}

describe("메모 HTTP 컨트롤러", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        listMemos.execute.mockClear();
        getMemosByTask.execute.mockClear();
        createMemo.execute.mockClear();
        updateMemo.execute.mockClear();
        deleteMemo.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    it("taskId 없는 조회는 사용자 전체 메모 목록으로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${MEMOS_PATH}`);

        expect(res.status).toBe(200);
        expect(listMemos.execute).toHaveBeenCalledWith(DEFAULT_USER_ID);
        expect(getMemosByTask.execute).not.toHaveBeenCalled();
    });

    it("taskId가 있으면 태스크·이벤트 조회로 위임하고 eventId를 함께 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${MEMOS_PATH}?taskId=t1&eventId=e1`);

        expect(res.status).toBe(200);
        expect(getMemosByTask.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "t1", "e1");
    });

    it("생성 요청 바디를 그대로 유스케이스에 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${MEMOS_PATH}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ taskId: "t1", body: "메모", author: "human" }),
        });

        expect(res.status).toBe(201);
        expect(createMemo.execute).toHaveBeenCalledWith({ userId: DEFAULT_USER_ID, taskId: "t1", body: "메모", author: "human" });
    });

    it("알려지지 않은 필드가 섞인 생성 요청은 400으로 거부한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${MEMOS_PATH}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ taskId: "t1", body: "메모", author: "human", extra: "x" }),
        });

        expect(res.status).toBe(400);
    });

    it("수정 요청을 id와 body로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${MEMOS_PATH}/m1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: "고친 메모" }),
        });

        expect(res.status).toBe(200);
        expect(updateMemo.execute).toHaveBeenCalledWith({ userId: DEFAULT_USER_ID, id: "m1", body: "고친 메모" });
    });

    it("삭제 요청을 id로 위임한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${MEMOS_PATH}/m1`, { method: "DELETE" });

        expect(res.status).toBe(200);
        expect(deleteMemo.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "m1");
    });
});
