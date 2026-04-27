/**
 * Outbound port — verify the task exists. Self-contained.
 */

export interface TaskAccessRecord {
    readonly id: string;
}

export interface ITaskAccess {
    findById(id: string): Promise<TaskAccessRecord | null>;
}
