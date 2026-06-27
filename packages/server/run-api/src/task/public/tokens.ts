/**
 * DI tokens for cross-module access to the task module.
 */
export const TASK_LIFECYCLE = "TASK_LIFECYCLE";
export const TASK_ACCESS = "TASK_ACCESS";
export const TASK_SNAPSHOT_QUERY = "TASK_SNAPSHOT_QUERY";

/**
 * Consumer-defined bridge token — task's "list a task's turns" feature reads
 * turn summaries that the verification (rules) module provides. task owns the
 * token (so it doesn't import rules); rules binds its TurnQueryRepository to it.
 */
export const TURN_QUERY_REPOSITORY_TOKEN = "TURN_QUERY_REPOSITORY";
