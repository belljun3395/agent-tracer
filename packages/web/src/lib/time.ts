/**
 * Compact relative time strings used in dense UI (sidebar rows, feed eyebrows).
 * Reads like a Twitter/Linear timestamp: "just now", "2m", "3h", "1d", "5w".
 *
 * Anchored on `nowMs` rather than Date.now() so callers can drive ticks
 * deterministically (useNowMs interval, tests).
 */
export function formatRelativeShort(input: Date | string | number, nowMs: number): string {
  const ts = toMs(input);
  const deltaMs = nowMs - ts;
  if (deltaMs < 30_000) return "just now";

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;

  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function toMs(input: Date | string | number): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") return Date.parse(input);
  return input.getTime();
}
