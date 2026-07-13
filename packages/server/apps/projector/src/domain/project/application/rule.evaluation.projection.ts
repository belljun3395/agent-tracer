import { Injectable } from "@nestjs/common";
import type { NotificationEnvelope } from "@monitor/kernel";
import { RuleEvaluator, type TurnEntity } from "@monitor/tracer-domain";
import { verdictNotification } from "~projector/support/notification.factory.js";
import type { RuleProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";

/** 턴이 닫힌 시점에 적용 가능한 규칙을 판정해 검증 알림으로 만든다. */
@Injectable()
export class RuleEvaluationProjection {
    async project(
        repositories: RuleProjectionRepositories,
        turn: TurnEntity,
        userId: string,
        now: Date,
    ): Promise<NotificationEnvelope[]> {
        const rules = await repositories.rules.findApplicable(userId, turn.taskId);
        if (rules.length === 0) return [];

        const evaluator = new RuleEvaluator(repositories);
        const touched = new Map<string, TurnEntity>();
        for (const rule of rules) {
            const target = await evaluator.evaluate(rule, turn, now);
            if (target !== null) touched.set(target.id, target);
        }
        return [...touched.values()].map((target) => verdictNotification(userId, target));
    }
}
