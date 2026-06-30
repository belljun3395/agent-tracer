import { type DynamicModule } from "@nestjs/common";
import { EventModule } from "@monitor/timeline-api/event.module.js";
import { RunModule } from "@monitor/run-api/run.module.js";
import { RulesModule } from "@monitor/rules-api/rules.module.js";
import { SettingsModule } from "@monitor/identity-api/settings/settings.module.js";
import { InsightModule } from "@monitor/insight-api/insight.module.js";

// HTTP 앱 전용: 모든 피처 모듈을 조립한다.
export function buildHttpFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
    const event = EventModule.register(databaseModule);
    const run = RunModule.register(databaseModule);
    const rules = RulesModule.register(databaseModule);
    const settings = SettingsModule.register(databaseModule);
    const insight = InsightModule.register(databaseModule);

    run.imports!.push(event, settings, rules);
    rules.imports!.push(event, run);
    insight.imports!.push(settings, run);

    return [event, run, rules, settings, insight];
}

// 워커 전용: 모든 피처 모듈을 조립한다.
export function buildWorkerFeatureModules(databaseModule: DynamicModule): DynamicModule[] {
    const event = EventModule.register(databaseModule);
    const run = RunModule.register(databaseModule);
    const rules = RulesModule.register(databaseModule);
    const settings = SettingsModule.register(databaseModule);
    const insight = InsightModule.register(databaseModule);

    run.imports!.push(event, settings, rules);
    rules.imports!.push(event, run);
    insight.imports!.push(settings, run);

    return [event, run, rules, settings, insight];
}
