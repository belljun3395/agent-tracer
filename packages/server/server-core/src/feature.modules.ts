import { type DynamicModule } from "@nestjs/common";
import { EventModule } from "@monitor/timeline-api/event/event.module.js";
import { SessionModule } from "@monitor/run-api/session/session.module.js";
import { TaskModule } from "@monitor/run-api/task/task.module.js";
import { TurnModule } from "@monitor/run-api/turn/turn.module.js";
import { VerificationModule } from "@monitor/rules-api/verification/verification.module.js";
import { RuleModule } from "@monitor/rules-api/rule/rule.module.js";
import { SettingsModule } from "@monitor/identity-api/settings/settings.module.js";
import { RuleBackfillModule } from "@monitor/rules-api/rule/backfill/rule.backfill.module.js";
import { RuleGenerationModule } from "@monitor/rules-api/rule/generation/rule.generation.module.js";
import { TaskCleanupModule } from "@monitor/insight-api/task-cleanup/task.cleanup.module.js";
import { RecipeModule } from "@monitor/insight-api/recipe/recipe.module.js";

// 피처 모듈을 등록하고 컨텍스트 간 import를 연결한다(forwardRef 없이 순환 해소).
// HTTP 앱과 워커가 같은 도메인 그래프를 공유하도록 조립을 한 곳에 둔다.
export function buildFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
    const event = EventModule.register(databaseModule);
    const session = SessionModule.register(databaseModule);
    const task = TaskModule.register(databaseModule);
    const turn = TurnModule.register(databaseModule);
    const verification = VerificationModule.register(databaseModule);
    const rule = RuleModule.register(databaseModule);
    const settings = SettingsModule.register(databaseModule);
    const ruleBackfill = RuleBackfillModule.register(databaseModule);
    const ruleGeneration = RuleGenerationModule.register(databaseModule);
    const taskCleanup = TaskCleanupModule.register(databaseModule);
    const recipe = RecipeModule.register(databaseModule);

    event.imports!.push(task, verification);
    session.imports!.push(task);
    task.imports!.push(event, session, settings, verification);
    turn.imports!.push(task, event);
    verification.imports!.push(event, rule);
    rule.imports!.push(verification);
    ruleBackfill.imports!.push(rule, verification);
    ruleGeneration.imports!.push(rule, settings, task);
    taskCleanup.imports!.push(settings, task);
    recipe.imports!.push(settings, task);

    return [
        event,
        session,
        task,
        turn,
        verification,
        rule,
        settings,
        ruleBackfill,
        ruleGeneration,
        taskCleanup,
        recipe,
    ];
}
