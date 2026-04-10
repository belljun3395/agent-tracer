import { Controller, Get, Query, HttpException, HttpStatus } from "@nestjs/common";
import type { MonitorServiceProvider } from "../service/monitor-service.provider.js";
import type { TaskSearchInput } from "../../application/types.js";
import { searchSchema } from "../schemas.js";
@Controller()
export class SearchController {
    constructor(private readonly service: MonitorServiceProvider) { }
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
