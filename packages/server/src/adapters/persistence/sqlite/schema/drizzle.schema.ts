import { relations } from "drizzle-orm";
import { runtimeSessionBindings } from "../runtime-bindings/sqlite.runtime-binding.tables.js";
import { searchDocuments } from "../search/sqlite.search.tables.js";
import { sessionsCurrent } from "../sessions/sqlite.session.tables.js";
import { taskRelations, tasksCurrent } from "../tasks/sqlite.task.tables.js";
import { timelineEvents } from "../timeline-events/sqlite.timeline-event.tables.js";
import {
  ruleEnforcements,
  rules,
  turnEvents,
  turns,
  verdicts,
} from "../verification/sqlite.verification.tables.js";

export { runtimeSessionBindings } from "../runtime-bindings/sqlite.runtime-binding.tables.js";
export { searchDocuments } from "../search/sqlite.search.tables.js";
export { sessionsCurrent } from "../sessions/sqlite.session.tables.js";
export { taskRelations, tasksCurrent } from "../tasks/sqlite.task.tables.js";
export { timelineEvents } from "../timeline-events/sqlite.timeline-event.tables.js";
export {
  ruleEnforcements,
  rules,
  turnEvents,
  turns,
  verdicts,
} from "../verification/sqlite.verification.tables.js";

export const tasksCurrentRelations = relations(tasksCurrent, ({ many }) => ({
  sessions: many(sessionsCurrent),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings),
  ownedRelations: many(taskRelations, { relationName: "taskRelationOwner" }),
  relatedRelations: many(taskRelations, { relationName: "taskRelationRelated" }),
}));

export const taskRelationsRelations = relations(taskRelations, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [taskRelations.taskId],
    references: [tasksCurrent.id],
    relationName: "taskRelationOwner",
  }),
  relatedTask: one(tasksCurrent, {
    fields: [taskRelations.relatedTaskId],
    references: [tasksCurrent.id],
    relationName: "taskRelationRelated",
  }),
}));

export const sessionsCurrentRelations = relations(sessionsCurrent, ({ one, many }) => ({
  task: one(tasksCurrent, {
    fields: [sessionsCurrent.taskId],
    references: [tasksCurrent.id],
  }),
  events: many(timelineEvents),
  runtimeBindings: many(runtimeSessionBindings),
}));

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [timelineEvents.taskId],
    references: [tasksCurrent.id],
  }),
  session: one(sessionsCurrent, {
    fields: [timelineEvents.sessionId],
    references: [sessionsCurrent.id],
  }),
}));

export const runtimeSessionBindingsRelations = relations(runtimeSessionBindings, ({ one }) => ({
  task: one(tasksCurrent, {
    fields: [runtimeSessionBindings.taskId],
    references: [tasksCurrent.id],
  }),
  session: one(sessionsCurrent, {
    fields: [runtimeSessionBindings.monitorSessionId],
    references: [sessionsCurrent.id],
  }),
}));

export const rulesRelations = relations(rules, ({ one, many }) => ({
  task: one(tasksCurrent, {
    fields: [rules.taskId],
    references: [tasksCurrent.id],
  }),
  verdicts: many(verdicts),
  enforcements: many(ruleEnforcements),
}));

export const turnsRelations = relations(turns, ({ one, many }) => ({
  session: one(sessionsCurrent, {
    fields: [turns.sessionId],
    references: [sessionsCurrent.id],
  }),
  task: one(tasksCurrent, {
    fields: [turns.taskId],
    references: [tasksCurrent.id],
  }),
  events: many(turnEvents),
  verdicts: many(verdicts),
}));

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  turn: one(turns, {
    fields: [turnEvents.turnId],
    references: [turns.id],
  }),
  event: one(timelineEvents, {
    fields: [turnEvents.eventId],
    references: [timelineEvents.id],
  }),
}));

export const verdictsRelations = relations(verdicts, ({ one }) => ({
  turn: one(turns, {
    fields: [verdicts.turnId],
    references: [turns.id],
  }),
  rule: one(rules, {
    fields: [verdicts.ruleId],
    references: [rules.id],
  }),
}));

export const ruleEnforcementsRelations = relations(ruleEnforcements, ({ one }) => ({
  event: one(timelineEvents, {
    fields: [ruleEnforcements.eventId],
    references: [timelineEvents.id],
  }),
  rule: one(rules, {
    fields: [ruleEnforcements.ruleId],
    references: [rules.id],
  }),
}));

export const drizzleSchema = {
  tasksCurrent,
  tasksCurrentRelations,
  taskRelations,
  taskRelationsRelations,
  sessionsCurrent,
  sessionsCurrentRelations,
  timelineEvents,
  timelineEventsRelations,
  runtimeSessionBindings,
  runtimeSessionBindingsRelations,
  searchDocuments,
  rules,
  rulesRelations,
  turns,
  turnsRelations,
  turnEvents,
  turnEventsRelations,
  verdicts,
  verdictsRelations,
  ruleEnforcements,
  ruleEnforcementsRelations,
};

export type DrizzleSchema = typeof drizzleSchema;
