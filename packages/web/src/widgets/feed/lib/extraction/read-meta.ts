/** 이 슬라이스가 읽는 수치는 토큰 수와 지속시간과 사용률뿐이라 음수는 손상으로 본다. */
export function readMetaNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** 같은 수치를 여러 이름으로 싣는 훅이 있어 먼저 맞는 키를 쓴다. */
export function readMetaNumberByKeys(
  meta: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = readMetaNumber(meta[key]);
    if (value !== null) return value;
  }
  return null;
}
