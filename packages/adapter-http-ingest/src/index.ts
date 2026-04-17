import "reflect-metadata";
import { MonitorService } from "@monitor/application";
import { IngestController } from "./ingest.controller.js";
import { EventController } from "./event.controller.js";
import { LifecycleController } from "./lifecycle.controller.js";
import { BookmarkWriteController } from "./bookmark-write.controller.js";
import { EvaluationWriteController } from "./evaluation-write.controller.js";

export { IngestController } from "./ingest.controller.js";
export { EventController } from "./event.controller.js";
export { LifecycleController } from "./lifecycle.controller.js";
export { BookmarkWriteController } from "./bookmark-write.controller.js";
export { EvaluationWriteController } from "./evaluation-write.controller.js";

function setParamTypes(target: object, ...types: unknown[]) {
    Reflect.defineMetadata("design:paramtypes", types, target);
}

export const writeControllers = [
    IngestController,
    EventController,
    LifecycleController,
    BookmarkWriteController,
    EvaluationWriteController,
] as const;

export function registerWriteControllerMetadata(serviceToken: unknown = MonitorService): void {
    for (const ctrl of writeControllers) {
        setParamTypes(ctrl, serviceToken);
    }
}
