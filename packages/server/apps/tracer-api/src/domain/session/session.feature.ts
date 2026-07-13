import { SessionController } from "~tracer-api/domain/session/inbound/session.controller.js";

/** session 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const sessionFeature = {
    controllers: [SessionController],
    providers: [],
};
