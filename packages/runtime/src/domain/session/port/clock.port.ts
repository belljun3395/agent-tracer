/** 지금을 에포크 밀리초로 읽는다. */
export interface ClockPort {
    now(): number;
}
