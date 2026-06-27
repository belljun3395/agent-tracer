/**
 * IdGenerator — abstracts identifier generation. Self-contained.
 */
export interface IIdGenerator {
    newUuid(): string;
}
