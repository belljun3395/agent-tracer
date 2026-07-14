import { InitTracer1783960000000 } from "./0001-InitTracer.js";
import { DropForbiddenExpectation1784090000000 } from "./0002-DropForbiddenExpectation.js";
import { RuleAnchoredToOneUtterance1784100000000 } from "./0003-RuleAnchoredToOneUtterance.js";
import { VerdictLivesUntilFulfilled1784110000000 } from "./0004-VerdictLivesUntilFulfilled.js";
import { DropJobFeedback1784120000000 } from "./0005-DropJobFeedback.js";

/** 읽기 모델 스키마의 마이그레이션 순서다. */
export const TRACER_MIGRATIONS = [
    InitTracer1783960000000,
    DropForbiddenExpectation1784090000000,
    RuleAnchoredToOneUtterance1784100000000,
    VerdictLivesUntilFulfilled1784110000000,
    DropJobFeedback1784120000000,
] as const;
