import { Injectable } from "@nestjs/common";
import { MonitorService, type MonitorPorts } from "@monitor/application";
@Injectable()
export class MonitorServiceProvider extends MonitorService {
    constructor(ports: MonitorPorts) {
        super(ports);
    }
}
