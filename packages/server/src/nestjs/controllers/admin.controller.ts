/**
 * @module nestjs/controllers/admin.controller
 *
 * Health check, overview, task read, observability, and openinference endpoints.
 */
import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { MonitorServiceProvider } from "../service/monitor-service.provider.js";

@Controller()
export class AdminController {
  constructor(private readonly service: MonitorServiceProvider) {}

  @Get("/health")
  health() {
    return { ok: true };
  }

  @Get("/api/overview")
  async overview() {
    const [stats, observability] = await Promise.all([
      this.service.getOverview(),
      this.service.getObservabilityOverview()
    ]);
    return {
      stats,
      observability: observability.observability
    };
  }

  @Get("/api/tasks")
  async listTasks() {
    return { tasks: await this.service.listTasks() };
  }

  @Get("/api/default-workspace")
  getDefaultWorkspace() {
    return { workspacePath: this.service.getDefaultWorkspacePath() };
  }

  @Get("/api/observability/overview")
  async observabilityOverview() {
    return this.service.getObservabilityOverview();
  }

  @Get("/api/tasks/:taskId/observability")
  async taskObservability(@Param("taskId") taskId: string) {
    const observability = await this.service.getTaskObservability(taskId);
    if (!observability) {
      throw new NotFoundException("Task not found");
    }
    return observability;
  }

  @Get("/api/tasks/:taskId/openinference")
  async taskOpenInference(@Param("taskId") taskId: string) {
    const exportPayload = await this.service.getTaskOpenInference(taskId);
    if (!exportPayload) {
      throw new NotFoundException("Task not found");
    }
    return exportPayload;
  }

  @Get("/api/tasks/:taskId")
  async getTask(@Param("taskId") taskId: string) {
    const task = await this.service.getTask(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    const [timeline, runtimeSession] = await Promise.all([
      this.service.getTaskTimeline(task.id),
      this.service.getTaskLatestRuntimeSession(task.id)
    ]);
    return {
      task,
      timeline,
      ...(runtimeSession ? { runtimeSessionId: runtimeSession.runtimeSessionId } : {})
    };
  }
}
