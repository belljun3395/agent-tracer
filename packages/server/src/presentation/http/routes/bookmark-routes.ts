/**
 * @module presentation/http/routes/bookmark-routes
 *
 * Bookmark CRUD endpoints.
 */
import { Router } from "express";
import type { MonitorService } from "../../../application/monitor-service.js";
import type { TaskBookmarkInput, TaskBookmarkDeleteInput } from "../../../application/types.js";
import { bookmarkSchema } from "../../schemas.js";

export function createBookmarkRoutes(service: MonitorService): Router {
  const router = Router();

  router.get("/api/bookmarks", async (req, res) => {
    const taskId = typeof req.query.taskId === "string" ? req.query.taskId : undefined;
    res.json({ bookmarks: await service.listBookmarks(taskId) });
  });

  router.post("/api/bookmarks", async (req, res) => {
    const bookmark = await service.saveBookmark(bookmarkSchema.parse(req.body) as TaskBookmarkInput);
    res.json({ bookmark });
  });

  router.delete("/api/bookmarks/:bookmarkId", async (req, res) => {
    const result = await service.deleteBookmark({ bookmarkId: req.params.bookmarkId } as TaskBookmarkDeleteInput);
    if (result === "not_found") { res.status(404).json({ ok: false, error: "Bookmark not found" }); return; }
    res.json({ ok: true });
  });

  return router;
}
