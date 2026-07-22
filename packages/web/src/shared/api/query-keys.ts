import type { JobKind, JobStatus } from "@monitor/kernel";
import type { ChatThreadId, TaskId } from "~web/shared/identity.js";

/** 여러 entity가 공유하는 TanStack Query 키 레지스트리다. */
export const monitorQueryKeys = {
  tasks: (archived: "active" | "archived" | "all" = "active") =>
    ["monitor", "tasks", archived] as const,
  taskPages: (
    archived: "active" | "archived" | "all" = "active",
    origin: "user" | "server-sdk" | "all" = "all",
    status:
      | "all"
      | "live"
      | "attn"
      | "done"
      | "running"
      | "waiting"
      | "completed"
      | "errored" = "all",
    limit = 100,
  ) => ["monitor", "tasks", "pages", archived, origin, status, limit] as const,
  scanAnchorTasks: (includeArchived: boolean) =>
    ["monitor", "tasks", "scan-anchors", includeArchived] as const,
  tasksPrefix: () => ["monitor", "tasks"] as const,
  taskDetail: (taskId: TaskId) => ["monitor", "task", taskId] as const,
  taskScopedPrefix: () => ["monitor", "task"] as const,
  taskChildren: (taskId: TaskId) => ["monitor", "task", taskId, "children"] as const,
  taskOpenInference: (taskId: TaskId) =>
    ["monitor", "task", taskId, "openinference"] as const,
  rules: () => ["monitor", "rules"] as const,
  taskRules: (taskId: TaskId) => ["monitor", "task", taskId, "rules"] as const,
  taskUserInputs: (taskId: TaskId) => ["monitor", "task", taskId, "user-inputs"] as const,
  search: (searchType: "tasks" | "events", query: string, taskId?: TaskId) =>
    (taskId
      ? ["monitor", "search", searchType, query, taskId]
      : ["monitor", "search", searchType, query]) as readonly [
      "monitor",
      "search",
      "tasks" | "events",
      string,
      ...(readonly TaskId[]),
    ],
  settings: () => ["monitor", "settings"] as const,
  ruleEvidence: (taskId: TaskId, ruleId: string) =>
    ["monitor", "task", taskId, "rule", ruleId, "evidence"] as const,
  memos: () => ["monitor", "memos"] as const,
  taskMemos: (taskId: TaskId) => ["monitor", "task", taskId, "memos"] as const,
  eventMemos: (taskId: TaskId, eventId: string) =>
    ["monitor", "task", taskId, "event", eventId, "memos"] as const,
  memosPrefix: () => ["monitor", "memos"] as const,
  tags: () => ["monitor", "tags"] as const,
  tagsPrefix: () => ["monitor", "tags"] as const,
  taskTags: (taskId: TaskId) => ["monitor", "task", taskId, "tags"] as const,
  tasksByTag: (tagId: string) => ["monitor", "tags", tagId, "tasks"] as const,
  taskVerifications: (taskId: TaskId) =>
    ["monitor", "task", taskId, "verifications"] as const,
  taskCleanupSuggestions: (status: "pending" | "all" = "pending") =>
    ["monitor", "task-cleanup", "suggestions", status] as const,
  taskCleanupSuggestionsPrefix: () => ["monitor", "task-cleanup", "suggestions"] as const,
  recipes: (status: string = "active") => ["monitor", "recipes", "list", status] as const,
  recipesPrefix: () => ["monitor", "recipes", "list"] as const,
  latestJob: (kind: JobKind, taskId?: TaskId) =>
    taskId
      ? (["monitor", "jobs", "latest", kind, taskId] as const)
      : (["monitor", "jobs", "latest", kind] as const),
  latestJobPrefix: (kind: JobKind) => ["monitor", "jobs", "latest", kind] as const,
  jobsHistory: (
    kind: JobKind | "all",
    status: JobStatus | "all",
    limit: number,
    offset: number,
  ) => ["monitor", "jobs", "history", kind, status, limit, offset] as const,
  jobsHistoryPrefix: () => ["monitor", "jobs", "history"] as const,
  job: (jobId: string) => ["monitor", "jobs", "detail", jobId] as const,
  jobSteps: (jobId: string) => ["monitor", "jobs", "steps", jobId] as const,
  daemonHealth: () => ["monitor", "daemon-health"] as const,
  chatThreads: () => ["monitor", "chat", "threads"] as const,
  chatThreadsPrefix: () => ["monitor", "chat", "threads"] as const,
  chatThread: (threadId: ChatThreadId) => ["monitor", "chat", "threads", threadId] as const,
  chatMessages: (threadId: ChatThreadId) =>
    ["monitor", "chat", "threads", threadId, "messages"] as const,
  chatExecutions: (threadId: ChatThreadId) =>
    ["monitor", "chat", "threads", threadId, "executions"] as const,
} as const;
