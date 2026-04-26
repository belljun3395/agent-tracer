import type { SessionCreatePortDto } from "~application/ports/sessions/dto/session.create.port.dto.js";
import type { SessionReadPort } from "~application/ports/sessions/session.read.port.js";
import type { SessionWritePort } from "~application/ports/sessions/session.write.port.js";

export type SessionCreateInput = SessionCreatePortDto;

export interface ISessionRepository extends SessionReadPort, SessionWritePort {}
