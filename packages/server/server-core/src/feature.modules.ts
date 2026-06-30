import { type DynamicModule } from "@nestjs/common";
import { EventModule } from "@monitor/timeline-api/event.module.js";
import { RunModule } from "@monitor/run-api/run.module.js";
import { RulesModule } from "@monitor/rules-api/rules.module.js";
import { SettingsModule } from "@monitor/identity-api/settings/settings.module.js";
import { TaskCleanupModule } from "@monitor/insight-api/task-cleanup/task.cleanup.module.js";
import { RecipeModule } from "@monitor/insight-api/recipe/recipe.module.js";

// HTTP 앱 전용: 모든 피처 모듈을 조립한다.
export function buildHttpFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
    const event = EventModule.register(databaseModule);
    const run = RunModule.register(databaseModule);
    const rules = RulesModule.register(databaseModule);
    const settings = SettingsModule.register(databaseModule);
    const taskCleanup = TaskCleanupModule.register(databaseModule);
    const recipe = RecipeModule.register(databaseModule);

    run.imports!.push(event, settings, rules);
    rules.imports!.push(event, run);
    taskCleanup.imports!.push(settings, run);
    recipe.imports!.push(settings, run);

    return [event, run, rules, settings, taskCleanup, recipe];
}

// 워커 전용: 모든 피처 모듈을 조립한다.
export function buildWorkerFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
    const event = EventModule.register(databaseModule);
    const run = RunModule.register(databaseModule);
    const rules = RulesModule.register(databaseModule);
    const settings = SettingsModule.register(databaseModule);
    const taskCleanup = TaskCleanupModule.register(databaseModule);
    const recipe = RecipeModule.register(databaseModule);

    run.imports!.push(event, settings, rules);
    rules.imports!.push(event, run);
    taskCleanup.imports!.push(settings, run);
    recipe.imports!.push(settings, run);

    return [event, run, rules, settings, taskCleanup, recipe];
}
