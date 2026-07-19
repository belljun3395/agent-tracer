import { InitTracer1783960000000 } from "./0001-InitTracer.js";
import { DropForbiddenExpectation1784090000000 } from "./0002-DropForbiddenExpectation.js";
import { RuleAnchoredToOneUtterance1784100000000 } from "./0003-RuleAnchoredToOneUtterance.js";
import { VerdictLivesUntilFulfilled1784110000000 } from "./0004-VerdictLivesUntilFulfilled.js";
import { DropJobFeedback1784120000000 } from "./0005-DropJobFeedback.js";
import { RuleCitations1784130000000 } from "./0006-RuleCitations.js";
import { AgentCompletionInbox1784140000000 } from "./0007-AgentCompletionInbox.js";
import { DropFileAffinity1784150000000 } from "./0008-DropFileAffinity.js";
import { RecipeApplicationNote1784160000000 } from "./0009-RecipeApplicationNote.js";
import { VerdictHighWaterMark1784170000000 } from "./0010-VerdictHighWaterMark.js";
import { SettingsScope1784211758198 } from "./0011-SettingsScope.js";
import { Memo1784211741081 } from "./0012-Memo.js";
import { AgentReadViews1784437024608 } from "./0013-AgentReadViews.js";

/** 읽기 모델 스키마의 마이그레이션 순서다. */
export const TRACER_MIGRATIONS = [
    InitTracer1783960000000,
    DropForbiddenExpectation1784090000000,
    RuleAnchoredToOneUtterance1784100000000,
    VerdictLivesUntilFulfilled1784110000000,
    DropJobFeedback1784120000000,
    RuleCitations1784130000000,
    AgentCompletionInbox1784140000000,
    DropFileAffinity1784150000000,
    RecipeApplicationNote1784160000000,
    VerdictHighWaterMark1784170000000,
    SettingsScope1784211758198,
    Memo1784211741081,
    AgentReadViews1784437024608,
] as const;
