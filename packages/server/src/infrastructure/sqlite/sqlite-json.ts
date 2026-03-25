export function parseJsonField<T>(value: string): T {
  return JSON.parse(value) as T;
}
