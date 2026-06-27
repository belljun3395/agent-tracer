export interface IIdGenerator {
    newUuid(): string;

    newUlid(timeMs?: number): string;
}
