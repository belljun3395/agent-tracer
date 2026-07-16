import type { IClock } from "@monitor/platform";

export const CLOCK = Symbol("Clock");

/** 응용 계층이 지금을 읽는 유일한 통로다. */
export type ClockPort = IClock;
