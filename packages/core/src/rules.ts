import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { normalizeLane, type TimelineLane } from "./domain.js";

const ruleLaneSchema = z.enum([
  "user",
  "exploration",
  "planning",
  "coordination",
  "implementation",
  "rules",
  "background",
  "questions",
  "todos",
  "file",
  "terminal",
  "tool",
  "thought",
  "message"
]);

const ruleDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  lane: ruleLaneSchema.optional(),
  keywords: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([])
});

const rulesIndexSchema = z.object({
  version: z.number().int().positive().default(1),
  rules: z.array(ruleDefinitionSchema).default([])
});

/** INDEX.yaml에서 파싱된 단일 규칙 정의 (zod 스키마 기반). */
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;

/** 파일 시스템에서 로드된 규칙. lane이 정규화된다. */
export interface LoadedRule extends Omit<RuleDefinition, "lane" | "keywords" | "tags"> {
  readonly lane?: TimelineLane | undefined;
  readonly keywords: readonly string[];
  readonly tags: readonly string[];
}

/** 로드된 규칙 인덱스. 모든 규칙과 로드 경로 포함. */
export interface RulesIndex {
  readonly version: number;
  readonly loadedFrom?: string;
  readonly rules: readonly LoadedRule[];
}

/** 지정된 디렉터리에서 INDEX.yaml을 읽어 RulesIndex를 로드. 파일이 없으면 빈 인덱스 반환. */
export function loadRulesIndex(rulesDir: string): RulesIndex {
  const indexPath = path.join(rulesDir, "INDEX.yaml");

  if (!fs.existsSync(indexPath)) {
    return {
      version: 1,
      loadedFrom: indexPath,
      rules: []
    };
  }

  const parsed = rulesIndexSchema.parse(
    YAML.parse(fs.readFileSync(indexPath, "utf8")) as unknown
  );

  return {
    version: parsed.version,
    loadedFrom: indexPath,
    rules: parsed.rules.map((rule) => normalizeLoadedRule(rule))
  };
}

function normalizeLoadedRule(rule: RuleDefinition): LoadedRule {
  const { lane, ...rest } = rule;
  return lane
    ? {
        ...rest,
        lane: normalizeLane(lane)
      }
    : rest;
}

/** 규칙의 keywords를 소문자로 정규화하여 반환. */
export function collectRuleKeywords(rule: LoadedRule): readonly string[] {
  return rule.keywords.map((value) => value.toLowerCase());
}

/** 레인의 우선순위 숫자를 반환. 높을수록 우선순위가 높음. */
export function lanePriority(lane: TimelineLane): number {
  switch (lane) {
    case "rules":          return 5;
    case "implementation": return 4;
    case "background":     return 4;
    case "coordination":   return 4;
    case "exploration":    return 3;
    case "questions":      return 3;
    case "todos":          return 3;
    case "planning":       return 2;
    case "user":           return 1;
  }
}
