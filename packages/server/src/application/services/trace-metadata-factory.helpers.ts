export function extractMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

export function extractMetadataBoolean(
  metadata: Record<string, unknown>,
  key: string
): boolean {
  return metadata[key] === true;
}

export function extractMetadataStringArray(
  metadata: Record<string, unknown>,
  key: string
): readonly string[] {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function normalizeTagSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
