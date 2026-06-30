import { type DynamicModule } from "@nestjs/common";
import { EventModule } from "@monitor/timeline-api/event/event.module.js";
import { SessionModule } from "@monitor/run-api/session/session.module.js";
import { TaskModule } from "@monitor/run-api/task/task.module.js";
import { TurnModule } from "@monitor/run-api/turn/turn.module.js";
import { VerificationModule } from "@monitor/rules-api/verification/verification.module.js";
import { RuleModule } from "@monitor/rules-api/rule/rule.module.js";
import { SettingsModule } from "@monitor/identity-api/settings/settings.module.js";
import { RuleBackfillModule } from "@monitor/rules-api/backfill/rule.backfill.module.js";
import { RuleGenerationModule } from "@monitor/rules-api/generation/rule.generation.module.js";
import { TaskCleanupModule } from "@monitor/insight-api/task-cleanup/task.cleanup.module.js";
import { RecipeModule } from "@monitor/insight-api/recipe/recipe.module.js";

// HTTP 앱 전용: 모든 피처 모듈을 조립한다.
export function buildHttpFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
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
    ruleGeneration.imports!.push(rule, task);
    taskCleanup.imports!.push(settings, task);
    recipe.imports!.push(settings, task);

    return [event, session, task, turn, verification, rule, settings, ruleBackfill, ruleGeneration, taskCleanup, recipe];
}

// 워커 전용: Turn·RuleBackfill은 워커 액티비티에서 사용하지 않으므로 제외한다.
export function buildWorkerFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
    const event = EventModule.register(databaseModule);
    const session = SessionModule.register(databaseModule);
    const task = TaskModule.register(databaseModule);
    const verification = VerificationModule.register(databaseModule);
    const rule = RuleModule.register(databaseModule);
    const settings = SettingsModule.register(databaseModule);
    const ruleGeneration = RuleGenerationModule.register(databaseModule);
    const taskCleanup = TaskCleanupModule.register(databaseModule);
    const recipe = RecipeModule.register(databaseModule);

    event.imports!.push(task, verification);
    session.imports!.push(task);
    task.imports!.push(event, session, settings, verification);
    verification.imports!.push(event, rule);
    rule.imports!.push(verification);
    ruleGeneration.imports!.push(rule, task);
    taskCleanup.imports!.push(settings, task);
    recipe.imports!.push(settings, task);

    return [event, session, task, verification, rule, settings, ruleGeneration, taskCleanup, recipe];
}
