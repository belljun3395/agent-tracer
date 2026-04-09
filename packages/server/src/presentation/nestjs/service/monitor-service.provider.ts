import { Injectable } from "@nestjs/common";
import { MonitorService } from "../../../application/monitor-service.js";
import type { MonitorPorts } from "../../../application/ports";
@Injectable()
export class MonitorServiceProvider extends MonitorService {
    constructor(ports: MonitorPorts) {
        super(ports);
    }
}
