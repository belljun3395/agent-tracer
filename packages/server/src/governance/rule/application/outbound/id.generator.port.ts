/**
 * IdGenerator — abstracts identifier generation so usecases stay deterministic
 * under test. Self-contained: no external imports.
 */
export interface IIdGenerator {
    newUuid(): string;
}
