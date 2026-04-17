import { Controller, Get, Query, HttpException, HttpStatus } from "@nestjs/common";
import { z } from "zod";
import { MonitorService } from "@monitor/application";
import type { TaskSearchInput } from "@monitor/application";

const searchSchema = z.object({
    query: z.string().trim().min(1),
    taskId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
});
@Controller()
export class SearchController {
    constructor(private readonly service: MonitorService) { }
    @Get("/api/search")
    async search(
    @Query("q")
    q?: string, 
    @Query("taskId")
    taskId?: string, 
    @Query("limit")
    limit?: string) {
        const parsed = searchSchema.safeParse({ query: q, taskId, limit });
        if (!parsed.success) {
            throw new HttpException({ error: parsed.error.format() }, HttpStatus.BAD_REQUEST);
        }
        return this.service.search(parsed.data as TaskSearchInput);
    }
}
