import type { TagDto, TagSummaryDto } from "@monitor/kernel";
import type { TagId } from "~web/shared/identity.js";
import type { TagRecord, TagSummaryRecord } from "~web/entities/tag/model/tag.js";

export function toTagRecord(tag: TagDto): TagRecord {
  return {
    id: tag.id as TagId,
    userId: tag.userId,
    name: tag.name,
    color: tag.color,
    description: tag.description,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

export function toTagSummaryRecord(tag: TagSummaryDto): TagSummaryRecord {
  return {
    ...toTagRecord(tag),
    taskCount: tag.taskCount,
  };
}
