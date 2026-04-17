import "reflect-metadata";
import { MonitorService } from "@monitor/application";
import { AdminController } from "./admin.controller.js";
import { BookmarkController } from "./bookmark.controller.js";
import { EvaluationController } from "./evaluation.controller.js";
import { SearchController } from "./search.controller.js";

export { AdminController } from "./admin.controller.js";
export { BookmarkController } from "./bookmark.controller.js";
export { EvaluationController } from "./evaluation.controller.js";
export { SearchController } from "./search.controller.js";

function setParamTypes(target: object, ...types: unknown[]) {
    Reflect.defineMetadata("design:paramtypes", types, target);
}

export const queryControllers = [
    AdminController,
    BookmarkController,
    EvaluationController,
    SearchController,
] as const;

export function registerQueryControllerMetadata(serviceToken: unknown = MonitorService): void {
    for (const ctrl of queryControllers) {
        setParamTypes(ctrl, serviceToken);
    }
}
