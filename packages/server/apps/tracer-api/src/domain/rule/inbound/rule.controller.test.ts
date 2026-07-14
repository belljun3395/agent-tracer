import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { DEFAULT_USER_ID, RULES_ALL_PATH } from "@monitor/kernel";
import { ApproveRuleUseCase } from "~tracer-api/domain/rule/application/command/approve.rule.usecase.js";
import { CreateRuleUseCase } from "~tracer-api/domain/rule/application/command/create.rule.usecase.js";
import { DeleteRuleUseCase } from "~tracer-api/domain/rule/application/command/delete.rule.usecase.js";
import { ReevaluateRuleUseCase } from "~tracer-api/domain/rule/application/command/reevaluate.rule.usecase.js";
import { UpdateRuleUseCase } from "~tracer-api/domain/rule/application/command/update.rule.usecase.js";
import { GetRuleEvidenceUseCase } from "~tracer-api/domain/rule/application/query/get.rule.evidence.usecase.js";
import { ListRulesUseCase } from "~tracer-api/domain/rule/application/query/list.rules.usecase.js";
import { RuleDefinitionController } from "./rule.definition.controller.js";
import { RuleLifecycleController } from "./rule.lifecycle.controller.js";
import { RuleQueryController } from "./rule.query.controller.js";

Reflect.defineMetadata("design:paramtypes", [ListRulesUseCase, GetRuleEvidenceUseCase], RuleQueryController);
Reflect.defineMetadata(
    "design:paramtypes",
    [CreateRuleUseCase, UpdateRuleUseCase, DeleteRuleUseCase],
    RuleDefinitionController,
);
Reflect.defineMetadata("design:paramtypes", [ApproveRuleUseCase, ReevaluateRuleUseCase], RuleLifecycleController);

const updateRule = {
    execute: vi.fn(async (input: { readonly id: string; readonly name?: string }) => ({
        rule: {
            id: input.id,
            userId: "local",
            name: input.name ?? "rule",
            expectation: { kind: "action", tool: "command" },
            taskId: null,
            source: "human",
            severity: "info",
            rationale: null,
            signature: "sig",
            userEdited: true,
            lastEditedBy: "human",
            rev: 1,
            createdAt: new Date(0).toISOString(),
        },
    })),
};
const reevaluateRule = {
    execute: vi.fn(async () => ({ reevaluated: 1 })),
};
const getRuleEvidence = {
    execute: vi.fn(async () => ({ ruleId: "rule-1", items: [] })),
};
const listRules = {
    execute: vi.fn(async () => ({ items: [] })),
};

@Module({
    controllers: [RuleQueryController, RuleDefinitionController, RuleLifecycleController],
    providers: [
        { provide: ListRulesUseCase, useValue: listRules },
        { provide: CreateRuleUseCase, useValue: { execute: vi.fn() } },
        { provide: UpdateRuleUseCase, useValue: updateRule },
        { provide: DeleteRuleUseCase, useValue: { execute: vi.fn() } },
        { provide: ApproveRuleUseCase, useValue: { execute: vi.fn() } },
        { provide: GetRuleEvidenceUseCase, useValue: getRuleEvidence },
        { provide: ReevaluateRuleUseCase, useValue: reevaluateRule },
    ],
})
class TestModule {}

describe("규칙 HTTP 컨트롤러", () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        listRules.execute.mockClear();
        updateRule.execute.mockClear();
        reevaluateRule.execute.mockClear();
        getRuleEvidence.execute.mockClear();
        await app?.close();
        app = undefined;
    });

    // 이 계약이 갈라지면 가드레일은 규칙을 한 건도 받지 못한다.
    it("데몬의 전체 조회 요청을 태스크 문맥 없는 조회로 받는다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}${RULES_ALL_PATH}`);

        expect(res.status).toBe(200);
        expect(listRules.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, { all: true });
    });

    it("수정 요청의 expect를 판별 유니온 그대로 치환한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/rules/rule-1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name: "CI 실패 링크 제공 시 원인 진단 후 수정",
                triggerOn: "user",
                expect: { kind: "command", commandMatches: ["gh run view"] },
                severity: "info",
                rationale: null,
            }),
        });

        expect(res.status).toBe(200);
        expect(updateRule.execute).toHaveBeenCalledWith({
            userId: DEFAULT_USER_ID,
            id: "rule-1",
            name: "CI 실패 링크 제공 시 원인 진단 후 수정",
            expectation: { kind: "command", commandMatches: ["gh run view"] },
            severity: "info",
            rationale: null,
        });
    });

    it("판정기가 못 푸는 조합의 expect는 400으로 거부한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/rules/rule-1`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                expect: { kind: "action", tool: "file-write", commandMatches: ["npm test"] },
            }),
        });

        expect(res.status).toBe(400);
    });

    it("재평가 요청을 규칙 식별자만으로 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/rules/rule-1/reevaluate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
        });

        expect(res.status).toBe(200);
        expect(reevaluateRule.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "rule-1");
    });

    it("근거 조회 요청의 규칙과 태스크 범위를 전달한다", async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        await app.listen(0, "127.0.0.1");

        const res = await fetch(`${await app.getUrl()}/api/v1/rules/rule-1/evidence?taskId=task-1`);

        expect(res.status).toBe(200);
        expect(getRuleEvidence.execute).toHaveBeenCalledWith(DEFAULT_USER_ID, "rule-1", "task-1");
    });
});
