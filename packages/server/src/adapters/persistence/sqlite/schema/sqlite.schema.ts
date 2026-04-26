import type Database from "better-sqlite3";
import { createEventLogSchema } from "../events/index.js";
import { createRuntimeBindingSchema } from "../runtime-bindings/sqlite.runtime-binding.schema.js";
import { createSearchSchema } from "../search/sqlite.search.schema.js";
import { createSessionSchema } from "../sessions/sqlite.session.schema.js";
import { createTaskSchema } from "../tasks/sqlite.task.schema.js";
import { createTimelineEventSchema } from "../timeline-events/sqlite.timeline-event.schema.js";
import { createTurnPartitionSchema } from "../turn-partitions/sqlite.turn-partition.schema.js";
import { createVerificationSchema } from "../verification/sqlite.verification.schema.js";

export function createSchema(db: Database.Database): void {
    db.pragma("foreign_keys = ON");
    createTaskSchema(db);
    createSessionSchema(db);
    createTimelineEventSchema(db);
    createRuntimeBindingSchema(db);
    createSearchSchema(db);
    createTurnPartitionSchema(db);
    createVerificationSchema(db);
    createEventLogSchema(db);
}
