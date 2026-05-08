import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface FileActivityRow {
  readonly path: string;
  readonly readCount: number;
  readonly writeCount: number;
  readonly mentionCount: number;
  readonly firstSeenAtMs: number;
  readonly lastSeenAtMs: number;
}

const WRITE_SUBTYPES = new Set([
  "create_file",
  "modify_file",
  "delete_file",
  "rename_file",
  "apply_patch",
]);
const READ_SUBTYPES = new Set([
  "read_file",
  "glob_files",
  "grep_code",
  "list_files",
]);

/**
 * Aggregate per-path activity from the timeline. Each event contributes:
 *
 *   - write : when its semantic subtype is in WRITE_SUBTYPES (apply_patch,
 *             create/modify/delete/rename_file)
 *   - read  : when its semantic subtype is in READ_SUBTYPES
 *   - mention: when the path appears only in `paths.mentionedPaths` (the
 *             agent referenced the file but didn't actually touch it)
 *
 * Result is sorted by `lastSeenAtMs` descending — most-recent activity
 * first, which is what operators typically want when scanning the
 * inspector for "what just got touched".
 */
export function buildFileActivity(
  events: readonly TimelineEventRecord[],
): readonly FileActivityRow[] {
  type Aggregate = {
    readCount: number;
    writeCount: number;
    mentionCount: number;
    firstSeenAtMs: number;
    lastSeenAtMs: number;
  };
  const byPath = new Map<string, Aggregate>();

  const bump = (
    path: string,
    kind: "read" | "write" | "mention",
    ms: number,
  ) => {
    let agg = byPath.get(path);
    if (!agg) {
      agg = {
        readCount: 0,
        writeCount: 0,
        mentionCount: 0,
        firstSeenAtMs: ms,
        lastSeenAtMs: ms,
      };
      byPath.set(path, agg);
    }
    if (kind === "read") agg.readCount += 1;
    else if (kind === "write") agg.writeCount += 1;
    else agg.mentionCount += 1;
    if (ms < agg.firstSeenAtMs) agg.firstSeenAtMs = ms;
    if (ms > agg.lastSeenAtMs) agg.lastSeenAtMs = ms;
  };

  for (const event of events) {
    if (!event.paths) continue;
    const ms = Date.parse(event.createdAt);
    const subtype = event.semantic?.subtypeKey;

    // Touched paths — primaryPath + filePaths get classified as read or write.
    const touched = new Set<string>();
    if (event.paths.primaryPath) touched.add(event.paths.primaryPath);
    for (const p of event.paths.filePaths) touched.add(p);

    for (const path of touched) {
      if (subtype && WRITE_SUBTYPES.has(subtype)) {
        bump(path, "write", ms);
      } else if (subtype && READ_SUBTYPES.has(subtype)) {
        bump(path, "read", ms);
      } else {
        // Unknown subtype but the event listed it under filePaths — treat
        // as a generic read (more accurate than dropping it).
        bump(path, "read", ms);
      }
    }

    // Mentioned-only paths — referenced but not touched.
    for (const p of event.paths.mentionedPaths) {
      if (touched.has(p)) continue;
      bump(p, "mention", ms);
    }
  }

  const rows: FileActivityRow[] = [];
  for (const [path, agg] of byPath) {
    rows.push({ path, ...agg });
  }
  rows.sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);
  return rows;
}
