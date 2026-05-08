import type { TimelineEventRecord } from "~domain/monitoring.js";
import { laneThemeForEvent, type LaneTheme } from "./lane-theme.js";
import { formatHHmmss, formatOffset } from "./format-time.js";
import {
  extractPaths,
  extractTokens,
  type TokensVm,
} from "./extract-metadata.js";

/**
 * Render-ready view-model for a single act card. Pure function output —
 * no React, no hooks. Tests build VMs directly without spinning up a tree.
 *
 * `event` is kept on the VM so consumers (Inspector, ActMeta) can pull
 * domain-specific fields without re-shaping the data twice. Other fields
 * are pre-computed once here so renderers don't repeat the same metadata
 * branching for every paint.
 */
export interface ActVm {
  readonly event: TimelineEventRecord;
  readonly lane: LaneTheme;
  readonly clockLabel: string; // "14:03:18"
  readonly offsetLabel: string; // "+6s"
  readonly toolName: string; // event.title — "Read · EventInspector.tsx"
  /**
   * Backend-provided fine-grained label (read_file / run_test / apply_patch...).
   * Null when no semantic classifier ran OR when the label duplicates toolName
   * (we don't want to render the same string twice).
   */
  readonly subtypeLabel: string | null;
  readonly bodyText: string | null;
  readonly hasViolation: boolean;
  readonly paths: readonly string[];
  readonly tokens: TokensVm | null;
}

export function classifyEvent(event: TimelineEventRecord, baseMs: number): ActVm {
  const eventMs = Date.parse(event.createdAt);
  const subtypeLabel = pickSubtypeLabel(event);
  return {
    event,
    lane: laneThemeForEvent(event),
    clockLabel: formatHHmmss(eventMs),
    offsetLabel: formatOffset(eventMs, baseMs),
    toolName: event.title,
    subtypeLabel,
    bodyText: event.body ?? null,
    hasViolation: detectViolation(event),
    paths: extractPaths(event),
    tokens: extractTokens(event),
  };
}

/**
 * Conservative heuristic — counts as a violation only when the domain
 * classifier explicitly tagged it. The Inspector tab will surface real
 * rule-match details; this flag just controls whether ActHeader paints
 * the small red `viol` badge.
 */
function detectViolation(event: TimelineEventRecord): boolean {
  const tags = event.classification.tags;
  return tags.includes("violation");
}

/**
 * Hide subtypeLabel when it duplicates the title — e.g. event.title
 * already says "Read · EventInspector.tsx" so showing "Read file" too
 * is redundant noise. Heuristic: case-insensitive substring overlap.
 */
function pickSubtypeLabel(event: TimelineEventRecord): string | null {
  const label = event.semantic?.subtypeLabel.trim();
  if (!label) return null;
  const title = event.title.toLowerCase();
  return title.includes(label.toLowerCase()) ? null : label;
}
