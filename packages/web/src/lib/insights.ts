/**
 * @module insights
 *
 * 타임라인 이벤트에서 인사이트 데이터를 추출하는 유틸리티.
 * 통계, 태그 분석, 규칙 커버리지, 태스크 요약 등을 담당.
 */

import type { MonitoringTask, RulesIndex, TimelineEvent, TimelineLane } from "../types.js";

export interface ObservabilityStats {
  readonly actions: number;
  readonly exploredFiles: number;
  readonly checks: number;
  readonly violations: number;
  readonly passes: number;
  readonly compactions: number;
}

export interface ExploredFileStat {
  readonly path: string;
  readonly count: number;
  readonly lastSeenAt: string;
}

export interface CompactInsight {
  readonly occurrences: number;
  readonly handoffCount: number;
  readonly eventCount: number;
  readonly lastSeenAt?: string | undefined;
  readonly latestTitle?: string | undefined;
  readonly latestBody?: string | undefined;
  readonly tagFacets: readonly string[];
}

export interface RuleCoverageStat {
  readonly ruleId: string;
  readonly title: string;
  readonly configured: boolean;
  readonly lane?: TimelineLane | undefined;
  readonly tags: readonly string[];
  readonly matchCount: number;
  readonly ruleEventCount: number;
  readonly checkCount: number;
  readonly violationCount: number;
  readonly passCount: number;
  readonly lastSeenAt?: string | undefined;
}

export interface TagInsight {
  readonly tag: string;
  readonly count: number;
  readonly lanes: readonly TimelineLane[];
  readonly ruleIds: readonly string[];
  readonly lastSeenAt: string;
}

export interface TaskProcessSection {
  readonly lane: TimelineLane;
  readonly title: string;
  readonly items: readonly string[];
}

export interface TaskExtraction {
  readonly objective: string;
  readonly summary: string;
  readonly sections: readonly TaskProcessSection[];
  readonly validations: readonly string[];
  readonly files: readonly string[];
  readonly rules: readonly string[];
  readonly brief: string;
  readonly processMarkdown: string;
}

export interface TimelineFilterOptions {
  readonly laneFilters: Readonly<Record<TimelineLane, boolean>>;
  readonly selectedTag?: string | null;
  readonly selectedRuleId?: string | null;
  readonly showRuleGapsOnly?: boolean;
}

/**
 * 이벤트 종류별 카운트 통계 생성.
 * action.logged, verification.logged, rule.logged 이벤트를 분류하여 집계.
 *
 * @param timeline - 집계할 이벤트 목록
 * @param exploredFiles - 탐색된 파일 수 (collectExploredFiles 결과 length)
 * @param compactOccurrences - compact 이벤트 발생 횟수
 * @returns actions, exploredFiles, checks, violations, passes, compactions 통계
 */
export function buildObservabilityStats(
  timeline: readonly TimelineEvent[],
  exploredFiles: number,
  compactOccurrences = 0
): ObservabilityStats {
  let actions = 0;
  let checks = 0;
  let violations = 0;
  let passes = 0;

  for (const event of timeline) {
    if (event.kind === "action.logged") {
      actions += 1;
    }

    if (event.kind === "verification.logged") {
      checks += 1;
      const verificationStatus = extractMetadataString(event.metadata, "verificationStatus");
      if (verificationStatus === "pass") passes += 1;
      if (verificationStatus === "fail") violations += 1;
    }

    if (event.kind === "rule.logged") {
      const ruleStatus = extractMetadataString(event.metadata, "ruleStatus");
      if (ruleStatus === "check") checks += 1;
      if (ruleStatus === "violation") violations += 1;
      if (ruleStatus === "pass" || ruleStatus === "fix-applied") passes += 1;
    }
  }

  return {
    actions,
    exploredFiles,
    checks,
    violations,
    passes,
    compactions: compactOccurrences
  };
}

/**
 * 탐색 이벤트에서 파일 활동 집계.
 * exploration 레인 이벤트의 metadata.filePaths를 수집하고 방문 횟수 및 최근 시각 순으로 정렬.
 *
 * @param timeline - 전체 이벤트 목록
 * @returns 파일 경로별 방문 횟수와 최근 시각 배열 (최근순 정렬)
 */
export function collectExploredFiles(
  timeline: readonly TimelineEvent[]
): readonly ExploredFileStat[] {
  const files = new Map<string, ExploredFileStat>();

  for (const event of timeline) {
    if (event.lane !== "exploration" || event.kind === "file.changed") {
      continue;
    }

    for (const filePath of extractMetadataStringArray(event.metadata, "filePaths")) {
      const existing = files.get(filePath);

      if (!existing) {
        files.set(filePath, {
          path: filePath,
          count: 1,
          lastSeenAt: event.createdAt
        });
        continue;
      }

      files.set(filePath, {
        path: filePath,
        count: existing.count + 1,
        lastSeenAt: latestTimestamp(existing.lastSeenAt, event.createdAt)
      });
    }
  }

  return [...files.values()].sort((left, right) => {
    const timeDelta = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.path.localeCompare(right.path);
  });
}

/**
 * 이벤트를 사람이 읽기 쉬운 짧은 요약으로 변환.
 * compact 태그 또는 compactPhase 메타데이터를 가진 이벤트를 집계하여
 * 발생 횟수, handoff/event 구분, 최신 내용, 태그 facet을 반환.
 *
 * @param timeline - 전체 이벤트 목록
 * @returns compact 활동 요약 (occurrences, handoffCount, eventCount, lastSeenAt, tagFacets)
 */
export function buildCompactInsight(
  timeline: readonly TimelineEvent[]
): CompactInsight {
  let handoffCount = 0;
  let eventCount = 0;
  let fallbackCount = 0;
  let lastSeenAt: string | undefined;
  let latestTitle: string | undefined;
  let latestBody: string | undefined;
  const tagFacets = new Set<string>();

  for (const event of timeline) {
    if (!isCompactEvent(event)) {
      continue;
    }

    fallbackCount += 1;
    const compactPhase = extractMetadataString(event.metadata, "compactPhase");
    if (compactPhase === "handoff") {
      handoffCount += 1;
    }
    if (compactPhase === "event") {
      eventCount += 1;
    }

    if (!lastSeenAt || Date.parse(event.createdAt) >= Date.parse(lastSeenAt)) {
      lastSeenAt = event.createdAt;
      latestTitle = event.title;
      latestBody = event.body;
    }

    for (const tag of event.classification.tags) {
      if (tag.startsWith("compact:")) {
        tagFacets.add(tag);
      }
    }
  }

  return {
    occurrences: eventCount > 0 ? eventCount : fallbackCount,
    handoffCount,
    eventCount,
    lastSeenAt,
    latestTitle,
    latestBody,
    tagFacets: [...tagFacets].sort()
  };
}

/**
 * 이벤트 목록에서 태스크 요약 정보 추출.
 * 목표, 프로세스 섹션, 검증 항목, 파일, 규칙, 요약 브리프 및 마크다운을 생성.
 *
 * @param task - 선택된 태스크 (null/undefined 가능)
 * @param timeline - 전체 이벤트 목록
 * @param exploredFiles - collectExploredFiles 결과
 * @returns 재사용 가능한 태스크 추출 데이터
 */
export function buildTaskExtraction(
  task: MonitoringTask | null | undefined,
  timeline: readonly TimelineEvent[],
  exploredFiles: readonly ExploredFileStat[]
): TaskExtraction {
  const objective = inferTaskObjective(task, timeline);
  const sections = buildTaskProcessSections(timeline);
  const validations = collectTaskValidations(timeline);
  const files = exploredFiles.slice(0, 6).map((file) => file.path);
  const rules = collectTaskRules(timeline);
  const summary = buildTaskSummary(timeline, sections, validations, files);
  const brief = buildTaskBrief(objective, summary, sections, validations);
  const processMarkdown = buildTaskProcessMarkdown(objective, summary, sections, validations, files, rules);

  return {
    objective,
    summary,
    sections,
    validations,
    files,
    rules,
    brief,
    processMarkdown
  };
}

/**
 * 태스크의 표시 제목 결정.
 * 저장된 제목이 generic agent-workspace 패턴이면 이벤트에서 더 의미있는 제목을 추론.
 *
 * @param task - 태스크 객체
 * @param timeline - 이벤트 목록 (제목 추론에 사용)
 * @returns 표시할 제목 문자열 (항상 non-null)
 */
export function buildTaskDisplayTitle(
  task: MonitoringTask | null | undefined,
  timeline: readonly TimelineEvent[]
): string {
  return resolvePreferredTaskTitle(task, timeline) ?? "Untitled task";
}

/**
 * 규칙 인덱스 대비 실제 이벤트 커버리지 통계 계산.
 * 설정된 규칙과 런타임에만 관찰된 규칙을 모두 포함하여 매칭/위반/통과 횟수를 집계.
 *
 * @param rulesIndex - 설정된 규칙 인덱스 (null/undefined 가능)
 * @param timeline - 전체 이벤트 목록
 * @returns configured 규칙 우선, 위반 횟수 내림차순으로 정렬된 통계 배열
 */
export function buildRuleCoverage(
  rulesIndex: RulesIndex | null | undefined,
  timeline: readonly TimelineEvent[]
): readonly RuleCoverageStat[] {
  const configuredRules = new Map(
    (rulesIndex?.rules ?? []).map((rule) => [
      rule.id,
      {
        ruleId: rule.id,
        title: rule.title,
        configured: true,
        lane: rule.lane,
        tags: [...rule.tags],
        matchCount: 0,
        ruleEventCount: 0,
        checkCount: 0,
        violationCount: 0,
        passCount: 0,
        lastSeenAt: undefined as string | undefined
      }
    ])
  );

  const allRules = new Map(configuredRules);

  for (const event of timeline) {
    const configuredMatchIds = new Set(
      event.classification.matches
        .filter((match) => match.source === "rules-index")
        .map((match) => match.ruleId)
    );
    const metadataRuleId = extractMetadataString(event.metadata, "ruleId");
    if (metadataRuleId) {
      configuredMatchIds.add(metadataRuleId);
    }

    for (const ruleId of configuredMatchIds) {
      const existing = allRules.get(ruleId);
      const next = existing ?? {
        ruleId,
        title: ruleId,
        configured: configuredRules.has(ruleId),
        lane: undefined,
        tags: [] as string[],
        matchCount: 0,
        ruleEventCount: 0,
        checkCount: 0,
        violationCount: 0,
        passCount: 0,
        lastSeenAt: undefined as string | undefined
      };

      const hasConfiguredMatch = event.classification.matches.some(
        (match) => match.ruleId === ruleId && match.source === "rules-index"
      );
      const ruleStatus = metadataRuleId === ruleId
        ? extractMetadataString(event.metadata, "ruleStatus")
        : undefined;

      allRules.set(ruleId, {
        ...next,
        matchCount: next.matchCount + (hasConfiguredMatch ? 1 : 0),
        ruleEventCount: next.ruleEventCount + (metadataRuleId === ruleId ? 1 : 0),
        checkCount: next.checkCount + (ruleStatus === "check" ? 1 : 0),
        violationCount: next.violationCount + (ruleStatus === "violation" ? 1 : 0),
        passCount: next.passCount + ((ruleStatus === "pass" || ruleStatus === "fix-applied") ? 1 : 0),
        lastSeenAt: next.lastSeenAt ? latestTimestamp(next.lastSeenAt, event.createdAt) : event.createdAt
      });
    }
  }

  return [...allRules.values()].sort((left, right) => {
    if (left.configured !== right.configured) {
      return left.configured ? -1 : 1;
    }

    if (right.violationCount !== left.violationCount) {
      return right.violationCount - left.violationCount;
    }

    const rightActivity = right.matchCount + right.ruleEventCount;
    const leftActivity = left.matchCount + left.ruleEventCount;
    if (rightActivity !== leftActivity) {
      return rightActivity - leftActivity;
    }

    if ((right.lastSeenAt ?? "") !== (left.lastSeenAt ?? "")) {
      return Date.parse(right.lastSeenAt ?? "1970-01-01T00:00:00.000Z")
        - Date.parse(left.lastSeenAt ?? "1970-01-01T00:00:00.000Z");
    }

    return left.title.localeCompare(right.title);
  });
}

/**
 * 이벤트 분류 태그별 통계 및 레인·규칙 참조 집계.
 * 발생 횟수 내림차순, 동률이면 최근 시각 순으로 정렬.
 *
 * @param timeline - 전체 이벤트 목록
 * @returns 태그별 count, lanes, ruleIds, lastSeenAt 배열
 */
export function buildTagInsights(
  timeline: readonly TimelineEvent[]
): readonly TagInsight[] {
  const tags = new Map<string, {
    count: number;
    lanes: Set<TimelineLane>;
    ruleIds: Set<string>;
    lastSeenAt: string;
  }>();

  for (const event of timeline) {
    const eventRuleIds = collectEventRuleIds(event);

    for (const tag of event.classification.tags) {
      const existing = tags.get(tag);

      if (!existing) {
        tags.set(tag, {
          count: 1,
          lanes: new Set([event.lane]),
          ruleIds: new Set(eventRuleIds),
          lastSeenAt: event.createdAt
        });
        continue;
      }

      existing.count += 1;
      existing.lanes.add(event.lane);
      for (const ruleId of eventRuleIds) {
        existing.ruleIds.add(ruleId);
      }
      existing.lastSeenAt = latestTimestamp(existing.lastSeenAt, event.createdAt);
    }
  }

  return [...tags.entries()]
    .map(([tag, value]) => ({
      tag,
      count: value.count,
      lanes: [...value.lanes].sort(),
      ruleIds: [...value.ruleIds].sort(),
      lastSeenAt: value.lastSeenAt
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      const timeDelta = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return left.tag.localeCompare(right.tag);
    });
}

/**
 * 레인 필터와 시간 범위로 이벤트를 필터링.
 * laneFilters, selectedTag, selectedRuleId, showRuleGapsOnly 조건을 모두 AND로 적용.
 *
 * @param timeline - 전체 이벤트 목록
 * @param options - 필터 옵션 (레인 토글, 태그, 규칙 ID, 규칙 갭 표시)
 * @returns 모든 조건을 통과한 이벤트 배열
 */
export function filterTimelineEvents(
  timeline: readonly TimelineEvent[],
  options: TimelineFilterOptions
): readonly TimelineEvent[] {
  return timeline.filter((event) => {
    if (!options.laneFilters[event.lane]) {
      return false;
    }

    if (options.selectedTag && !eventHasTag(event, options.selectedTag)) {
      return false;
    }

    if (options.selectedRuleId && !eventHasRule(event, options.selectedRuleId)) {
      return false;
    }

    return !(options.showRuleGapsOnly && !eventHasRuleGap(event));
  });
}

/**
 * 이벤트가 특정 태그를 가지고 있는지 확인.
 * @param event - 검사할 이벤트
 * @param tag - 찾을 태그 문자열
 */
export function eventHasTag(event: TimelineEvent, tag: string): boolean {
  return event.classification.tags.includes(tag);
}

/**
 * 이벤트가 특정 규칙과 연결되어 있는지 확인.
 * classification.matches와 metadata.ruleId 모두를 검사.
 * @param event - 검사할 이벤트
 * @param ruleId - 찾을 규칙 ID
 */
export function eventHasRule(event: TimelineEvent, ruleId: string): boolean {
  return collectEventRuleIds(event).includes(ruleId);
}

/**
 * 이벤트가 rules-index 기반의 설정된 규칙과 매칭되었는지 확인.
 * @param event - 검사할 이벤트
 */
export function eventHasConfiguredRuleMatch(event: TimelineEvent): boolean {
  return event.classification.matches.some((match) => match.source === "rules-index");
}

/**
 * 이벤트가 규칙 갭인지 확인. user 레인이 아니고 설정된 규칙 매칭이 없으면 갭으로 간주.
 * @param event - 검사할 이벤트
 */
export function eventHasRuleGap(event: TimelineEvent): boolean {
  return event.lane !== "user" && !eventHasConfiguredRuleMatch(event);
}

function collectEventRuleIds(event: TimelineEvent): readonly string[] {
  const ruleIds = new Set(
    event.classification.matches
      .filter((match) => match.source === "rules-index")
      .map((match) => match.ruleId)
  );
  const metadataRuleId = extractMetadataString(event.metadata, "ruleId");
  if (metadataRuleId) {
    ruleIds.add(metadataRuleId);
  }
  return [...ruleIds];
}

function latestTimestamp(left: string, right: string): string {
  return Date.parse(left) > Date.parse(right) ? left : right;
}

const TASK_EXTRACTION_LANES: readonly TimelineLane[] = [
  "exploration",
  "planning",
  "implementation",
  "rules"
];

const TASK_EXTRACTION_LANE_TITLES: Readonly<Record<TimelineLane, string>> = {
  user: "User Context",
  exploration: "Explore the codebase",
  planning: "Plan the approach",
  implementation: "Implement the change",
  rules: "Validate and enforce rules"
};

function isCompactEvent(event: TimelineEvent): boolean {
  return event.classification.tags.includes("compact")
    || extractMetadataBoolean(event.metadata, "compactEvent")
    || Boolean(extractMetadataString(event.metadata, "compactPhase"))
    || Boolean(extractMetadataString(event.metadata, "compactEventType"));
}

function inferTaskObjective(
  task: MonitoringTask | null | undefined,
  timeline: readonly TimelineEvent[]
): string {
  return resolvePreferredTaskTitle(task, timeline) ?? "Reconstruct the selected task into a reusable process.";
}

const GENERIC_TASK_TITLE_PREFIXES = new Set([
  "agent",
  "ai cli",
  "aider",
  "claude",
  "claude code",
  "codex",
  "cursor",
  "gemini",
  "gemini cli",
  "open code",
  "opencode"
]);

function resolvePreferredTaskTitle(
  task: MonitoringTask | null | undefined,
  timeline: readonly TimelineEvent[]
): string | null {
  return meaningfulTaskTitle(task) ?? inferTaskTitleSignal(timeline) ?? normalizeSentence(task?.title);
}

function meaningfulTaskTitle(task: MonitoringTask | null | undefined): string | null {
  const title = normalizeSentence(task?.title);

  if (!title) {
    return null;
  }

  return isGenericWorkspaceTaskTitle(task, title) ? null : title;
}

function inferTaskTitleSignal(timeline: readonly TimelineEvent[]): string | null {
  const userGoal = timeline.find((event) =>
    event.lane === "user"
    && event.kind !== "task.start"
    && event.kind !== "task.complete"
    && event.kind !== "task.error"
    && event.body
  )?.body;
  const startSummary = timeline.find((event) => event.kind === "task.start" && event.body)?.body;
  const firstMeaningfulEvent = timeline.find((event) =>
    event.kind !== "task.start"
    && event.kind !== "task.complete"
    && event.kind !== "task.error"
    && event.kind !== "file.changed"
  );

  return (
    meaningfulInferredTaskTitle(userGoal)
    ?? meaningfulInferredTaskTitle(startSummary)
    ?? meaningfulInferredTaskTitle(firstMeaningfulEvent?.body)
    ?? meaningfulInferredTaskTitle(firstMeaningfulEvent?.title)
  );
}

function meaningfulInferredTaskTitle(value?: string): string | null {
  const normalized = normalizeSentence(value);

  if (!normalized || isAgentSessionBoilerplate(normalized)) {
    return null;
  }

  return normalized;
}

function isGenericWorkspaceTaskTitle(
  task: MonitoringTask | null | undefined,
  normalizedTitle: string
): boolean {
  if (!task) {
    return false;
  }

  const segments = normalizedTitle.split(/\s+[—–-]\s+/);
  if (segments.length !== 2) {
    return false;
  }

  const [prefix, suffix] = segments;
  const normalizedPrefix = normalizeTitleToken(prefix);
  if (!GENERIC_TASK_TITLE_PREFIXES.has(normalizedPrefix)) {
    return false;
  }

  const workspaceName = task.workspacePath
    ?.split("/")
    .filter(Boolean)
    .pop();
  const normalizedSuffix = normalizeTitleToken(suffix);

  return normalizedSuffix === normalizeTitleToken(task.slug)
    || (workspaceName ? normalizedSuffix === normalizeTitleToken(workspaceName) : false);
}

function normalizeTitleToken(value?: string): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function isAgentSessionBoilerplate(value: string): boolean {
  const normalized = normalizeTitleToken(value);

  return /^(claude code|claude|opencode|open code|codex|cursor|gemini(?: cli)?|agent|ai cli) session started\b/.test(normalized)
    || /^(claude code|claude|opencode|open code|codex|cursor|gemini(?: cli)?|agent|ai cli) - /.test(normalized);
}

function buildTaskProcessSections(
  timeline: readonly TimelineEvent[]
): readonly TaskProcessSection[] {
  return TASK_EXTRACTION_LANES
    .map((lane) => {
      const items = uniqueStrings(
        timeline
          .filter((event) => event.lane === lane)
          .map(describeProcessEvent)
          .filter((value): value is string => Boolean(value))
      ).slice(0, 3);

      if (items.length === 0) {
        return null;
      }

      return {
        lane,
        title: TASK_EXTRACTION_LANE_TITLES[lane],
        items: items as readonly string[]
      };
    })
    .filter((value): value is TaskProcessSection => value !== null);
}

function collectTaskValidations(
  timeline: readonly TimelineEvent[]
): readonly string[] {
  return uniqueStrings(
    timeline
      .filter((event) => event.kind === "verification.logged" || event.kind === "rule.logged")
      .map(describeValidationEvent)
      .filter((value): value is string => Boolean(value))
  ).slice(0, 5);
}

function collectTaskRules(
  timeline: readonly TimelineEvent[]
): readonly string[] {
  const rules = new Set<string>();

  for (const event of timeline) {
    const metadataRuleId = extractMetadataString(event.metadata, "ruleId");
    if (metadataRuleId) {
      rules.add(metadataRuleId);
    }

    for (const match of event.classification.matches) {
      rules.add(match.ruleId);
    }
  }

  return [...rules].sort();
}

function buildTaskSummary(
  timeline: readonly TimelineEvent[],
  sections: readonly TaskProcessSection[],
  validations: readonly string[],
  files: readonly string[]
): string {
  const eventCount = timeline.filter((event) => event.kind !== "file.changed").length;
  const laneText = sections.map((section) => section.lane).join(", ");
  const parts = [`${eventCount} recorded task events`];

  if (laneText) {
    parts.push(`lanes: ${laneText}`);
  }
  if (validations.length > 0) {
    parts.push(`${validations.length} validation checkpoints`);
  }
  if (files.length > 0) {
    parts.push(`${files.length} touched files`);
  }

  return normalizeSentence(parts.join(" | ")) ?? "Recorded task activity is available for extraction.";
}

function buildTaskBrief(
  objective: string,
  summary: string,
  sections: readonly TaskProcessSection[],
  validations: readonly string[]
): string {
  const lines = [
    `Task: ${objective}`,
    `Summary: ${summary}`
  ];

  if (sections.length > 0) {
    lines.push("Process:");
    for (const section of sections) {
      for (const item of section.items) {
        lines.push(`- ${TASK_EXTRACTION_LANE_TITLES[section.lane]}: ${item}`);
      }
    }
  }

  if (validations.length > 0) {
    lines.push("Validation:");
    for (const item of validations) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n");
}

function buildTaskProcessMarkdown(
  objective: string,
  summary: string,
  sections: readonly TaskProcessSection[],
  validations: readonly string[],
  files: readonly string[],
  rules: readonly string[]
): string {
  const lines = [
    "# Extracted Task",
    "",
    `## Objective`,
    objective,
    "",
    "## Summary",
    summary
  ];

  if (sections.length > 0) {
    lines.push("", "## Process");
    for (const section of sections) {
      lines.push("", `### ${section.title}`);
      for (const item of section.items) {
        lines.push(`- ${item}`);
      }
    }
  }

  if (validations.length > 0) {
    lines.push("", "## Validation");
    for (const item of validations) {
      lines.push(`- ${item}`);
    }
  }

  if (files.length > 0) {
    lines.push("", "## Related Files");
    for (const filePath of files) {
      lines.push(`- ${filePath}`);
    }
  }

  if (rules.length > 0) {
    lines.push("", "## Rules");
    for (const ruleId of rules) {
      lines.push(`- ${ruleId}`);
    }
  }

  return lines.join("\n");
}

function describeProcessEvent(event: TimelineEvent): string | null {
  if (event.kind === "file.changed" || event.kind === "task.complete" || event.kind === "task.error") {
    return null;
  }

  const title = normalizeSentence(event.title);
  const detail = primaryEventDetail(event);

  if (!title && !detail) {
    return null;
  }

  if (detail && title && normalizeForDedup(detail) !== normalizeForDedup(title)) {
    return `${title}: ${detail}`;
  }

  return detail ?? title;
}

function describeValidationEvent(event: TimelineEvent): string | null {
  if (event.kind === "verification.logged") {
    const title = normalizeSentence(event.title) ?? "Verification step";
    const result = normalizeSentence(
      extractMetadataString(event.metadata, "result")
      ?? extractMetadataString(event.metadata, "verificationStatus")
      ?? event.body
    );

    return result ? `${title}: ${result}` : title;
  }

  if (event.kind === "rule.logged") {
    const ruleId = extractMetadataString(event.metadata, "ruleId") ?? "rule";
    const status = extractMetadataString(event.metadata, "ruleStatus") ?? "observed";
    const severity = extractMetadataString(event.metadata, "severity");
    return severity
      ? `${ruleId} ${status} (${severity})`
      : `${ruleId} ${status}`;
  }

  return null;
}

function primaryEventDetail(event: TimelineEvent): string | null {
  const metadata = event.metadata;
  const candidates = [
    event.kind === "rule.logged"
      ? [
          extractMetadataString(metadata, "ruleId"),
          extractMetadataString(metadata, "ruleStatus"),
          extractMetadataString(metadata, "severity")
        ].filter((value): value is string => Boolean(value)).join(" · ")
      : undefined,
    event.kind === "verification.logged"
      ? extractMetadataString(metadata, "result")
      : undefined,
    extractMetadataString(metadata, "action"),
    extractMetadataString(metadata, "command"),
    extractMetadataString(metadata, "toolName"),
    event.body
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSentence(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const deduped = new Map<string, string>();

  for (const value of values) {
    const key = normalizeForDedup(value);
    if (!key || deduped.has(key)) {
      continue;
    }
    deduped.set(key, value);
  }

  return [...deduped.values()];
}

function normalizeForDedup(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSentence(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 120
    ? `${normalized.slice(0, 117)}...`
    : normalized;
}

/** 단일 questionId에 대한 질문 흐름 그룹. */
export interface QuestionGroup {
  readonly questionId: string;
  readonly phases: readonly {
    readonly phase: string;
    readonly event: TimelineEvent;
  }[];
  readonly isComplete: boolean; // concluded 단계 존재 여부
}

/** 단일 todoId에 대한 할일 전환 그룹. */
export interface TodoGroup {
  readonly todoId: string;
  readonly title: string;
  readonly transitions: readonly {
    readonly state: string;
    readonly event: TimelineEvent;
  }[];
  readonly currentState: string;
  readonly isTerminal: boolean; // completed 또는 cancelled
}

/** 타임라인에서 추출한 AI 모델 요약. */
export interface ModelSummary {
  /** 태스크 전체에서 가장 많이 등장한 모델명. */
  readonly defaultModelName?: string;
  /** 태스크 전체에서 가장 많이 등장한 제공자명. */
  readonly defaultModelProvider?: string;
  /** 모델명별 이벤트 수. */
  readonly modelCounts: Readonly<Record<string, number>>;
}

/**
 * questionId로 question.logged 이벤트를 그룹화한다.
 * 같은 questionId의 이벤트를 phase 순서(asked→answered→concluded)로 정렬.
 */
export function buildQuestionGroups(
  timeline: readonly TimelineEvent[]
): readonly QuestionGroup[] {
  const PHASE_ORDER: Record<string, number> = { asked: 0, answered: 1, concluded: 2 };
  const groups = new Map<string, { phases: Array<{ phase: string; event: TimelineEvent }> }>();

  for (const event of timeline) {
    if (event.kind !== "question.logged") continue;
    const questionId = extractMetadataString(event.metadata, "questionId");
    if (!questionId) continue;
    const phase = extractMetadataString(event.metadata, "questionPhase") ?? "asked";
    const existing = groups.get(questionId) ?? { phases: [] };
    existing.phases.push({ phase, event });
    groups.set(questionId, existing);
  }

  return [...groups.entries()].map(([questionId, group]) => {
    const sorted = [...group.phases].sort((a, b) => {
      const pDiff = (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99);
      if (pDiff !== 0) return pDiff;
      // 같은 phase면 sequence → createdAt 순
      const aSeq = typeof a.event.metadata["sequence"] === "number" ? a.event.metadata["sequence"] as number : Infinity;
      const bSeq = typeof b.event.metadata["sequence"] === "number" ? b.event.metadata["sequence"] as number : Infinity;
      if (aSeq !== bSeq) return aSeq - bSeq;
      return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
    });
    return {
      questionId,
      phases: sorted,
      isComplete: sorted.some(p => p.phase === "concluded")
    };
  });
}

const TODO_TERMINAL_STATES = new Set(["completed", "cancelled"]);
const TODO_STATE_ORDER: Record<string, number> = { added: 0, in_progress: 1, completed: 2, cancelled: 2 };

/**
 * todoId로 todo.logged 이벤트를 그룹화한다.
 * 같은 todoId의 이벤트를 state 순서(added→in_progress→completed/cancelled)로 정렬.
 */
export function buildTodoGroups(
  timeline: readonly TimelineEvent[]
): readonly TodoGroup[] {
  const groups = new Map<string, { title: string; transitions: Array<{ state: string; event: TimelineEvent }> }>();

  for (const event of timeline) {
    if (event.kind !== "todo.logged") continue;
    const todoId = extractMetadataString(event.metadata, "todoId");
    if (!todoId) continue;
    const state = extractMetadataString(event.metadata, "todoState") ?? "added";
    const existing = groups.get(todoId) ?? { title: event.title, transitions: [] };
    existing.transitions.push({ state, event });
    groups.set(todoId, existing);
  }

  return [...groups.entries()].map(([todoId, group]) => {
    const sorted = [...group.transitions].sort((a, b) => {
      const sDiff = (TODO_STATE_ORDER[a.state] ?? 99) - (TODO_STATE_ORDER[b.state] ?? 99);
      if (sDiff !== 0) return sDiff;
      const aSeq = typeof a.event.metadata["sequence"] === "number" ? a.event.metadata["sequence"] as number : Infinity;
      const bSeq = typeof b.event.metadata["sequence"] === "number" ? b.event.metadata["sequence"] as number : Infinity;
      if (aSeq !== bSeq) return aSeq - bSeq;
      return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
    });
    const last = sorted[sorted.length - 1];
    const currentState = last?.state ?? "added";
    return {
      todoId,
      title: group.title,
      transitions: sorted,
      currentState,
      isTerminal: TODO_TERMINAL_STATES.has(currentState)
    };
  });
}

/**
 * 타임라인 이벤트에서 AI 모델 요약을 추출한다.
 * modelName 메타데이터를 가진 이벤트를 집계하여 가장 많이 등장한 모델명을 반환.
 */
export function buildModelSummary(
  timeline: readonly TimelineEvent[]
): ModelSummary {
  const modelCounts: Record<string, number> = {};

  for (const event of timeline) {
    const modelName = extractMetadataString(event.metadata, "modelName");
    if (modelName) {
      modelCounts[modelName] = (modelCounts[modelName] ?? 0) + 1;
    }
  }

  const entries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
  const defaultModelName = entries[0]?.[0];
  const defaultModelProvider = defaultModelName
    ? extractMetadataString(
        timeline.find(e => extractMetadataString(e.metadata, "modelName") === defaultModelName)?.metadata ?? {},
        "modelProvider"
      )
    : undefined;

  return { defaultModelName, defaultModelProvider, modelCounts };
}

function extractMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function extractMetadataBoolean(
  metadata: Record<string, unknown>,
  key: string
): boolean {
  return metadata[key] === true;
}

function extractMetadataStringArray(
  metadata: Record<string, unknown>,
  key: string
): readonly string[] {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}
