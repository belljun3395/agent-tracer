export const FILE_AFFINITY_ROLES = ["read", "write", "both"] as const;

export type FileAffinityRole = (typeof FILE_AFFINITY_ROLES)[number];
