const UNITS = ["B", "KB", "MB", "GB"] as const;

/** 바이트 수를 사람이 읽을 자릿수(B/KB/MB/GB)로 압축한다. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  return `${formatted} ${UNITS[exponent]}`;
}
