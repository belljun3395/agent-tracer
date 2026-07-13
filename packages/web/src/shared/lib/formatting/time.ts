/** 조밀한 UI(사이드바 row, feed eyebrow)에서 쓰는 압축된 상대 시간 문자열. */
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

/** 로컬 타임존 기준 `YYYY-MM-DD HH:MM:SS` 형식의 절대 타임스탬프. */
export function formatAbsoluteHHmmss(input: Date | string | number): string {
  const ms = toMs(input);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 로컬 시각을 시·분·초로 표시한다. */
export function formatHHmmss(input: Date | string | number): string {
  const date = new Date(toMs(input));
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** 로컬 시각을 시·분으로 표시한다. */
export function formatHHmm(input: Date | string | number): string {
  const date = new Date(toMs(input));
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 기준 시각부터의 경과를 타임라인용 압축 문자열로 표시한다. */
export function formatOffset(eventMs: number, baseMs: number): string {
  const seconds = Math.max(0, Math.floor((eventMs - baseMs) / 1000));
  if (seconds < 60) return `+${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `+${minutes}m ${pad2(seconds % 60)}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `+${hours}h ${pad2(minutes)}m`;
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function toMs(input: Date | string | number): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") return Date.parse(input);
  return input.getTime();
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}
