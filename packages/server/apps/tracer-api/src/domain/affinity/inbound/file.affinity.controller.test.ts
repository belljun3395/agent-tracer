import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListFileAffinityUseCase } from "~tracer-api/domain/affinity/application/query/list.file.affinity.usecase.js";
import { FileAffinityController } from "./file.affinity.controller.js";

Reflect.defineMetadata("design:paramtypes", [ListFileAffinityUseCase], FileAffinityController);

const listFileAffinity = {
    execute: vi.fn(async () => ({ intent: "refactor", items: [] })),
};

@Module({
    controllers: [FileAffinityController],
    providers: [{ provide: ListFileAffinityUseCase, useValue: listFileAffinity }],
})
class TestModule {}

describe("FileAffinityController", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        listFileAffinity.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    it("파일 친화도 쿼리를 독립 경로로 제공한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const response = await fetch(`${await app.getUrl()}/api/v1/file-affinity?intent=refactor&limit=7`);

        expect(response.status).toBe(200);
        expect(listFileAffinity.execute).toHaveBeenCalledWith("refactor", 7);
    });
});
