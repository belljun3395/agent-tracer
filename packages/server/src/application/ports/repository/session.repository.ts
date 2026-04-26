import type { SessionCreatePortDto, SessionReadPort, SessionWritePort } from "../sessions/index.js";

export type SessionCreateInput = SessionCreatePortDto;

export interface ISessionRepository extends SessionReadPort, SessionWritePort {}
