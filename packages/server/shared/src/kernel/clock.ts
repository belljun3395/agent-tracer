export const CLOCK_PORT = "CLOCK_PORT" as const;
export const ID_GENERATOR_PORT = "ID_GENERATOR_PORT" as const;

export interface IClock {

    nowMs(): number;

    nowIso(): string;
}

export interface IIdGenerator {

    newUuid(): string;

    newUlid(timeMs?: number): string;
}
