import { FindOperator, type DeleteResult, type FindOptionsOrder, type FindOptionsWhere, type ObjectLiteral, type Repository } from "typeorm";

/** TypeORM Repository 표면 일부만 흉내내는 인메모리 대역이다. */
export interface InMemoryRepository<T extends ObjectLiteral> extends Pick<Repository<T>, "find" | "findOne" | "upsert" | "delete" | "count" | "createQueryBuilder"> {
    seed(...entities: T[]): void;
    all(): T[];
    snapshot(): T[];
    restore(snapshot: T[]): void;
}

function cloneRow<T extends ObjectLiteral>(row: T): T {
    return Object.assign(Object.create(Object.getPrototypeOf(row) as object) as T, row);
}

function fieldMatches(actual: unknown, expected: unknown): boolean {
    // IsNull()과 In() 외의 FindOperator는 지원하지 않는다.
    if (expected instanceof FindOperator) {
        if (expected.type === "isNull") return actual === null;
        if (expected.type === "in") return (expected.value as unknown[]).includes(actual);
        return false;
    }
    return actual === expected;
}

function matches<T extends ObjectLiteral>(entity: T, where: FindOptionsWhere<T>): boolean {
    return Object.entries(where).every(([key, value]) => fieldMatches(entity[key as keyof T], value));
}

function matchesWhere<T extends ObjectLiteral>(entity: T, where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): boolean {
    return Array.isArray(where) ? where.some((entry) => matches(entity, entry)) : matches(entity, where);
}

function sorted<T extends ObjectLiteral>(entities: T[], order?: FindOptionsOrder<T>): T[] {
    if (!order) return entities;
    const keys = Object.entries(order) as [keyof T, "ASC" | "DESC"][];
    if (keys.length === 0) return entities;
    return [...entities].sort((a, b) => {
        for (const [field, direction] of keys) {
            const av = a[field];
            const bv = b[field];
            if (av === bv) continue;
            const factor = direction === "DESC" ? -1 : 1;
            return av > bv ? factor : -factor;
        }
        return 0;
    });
}

function toCamel(column: string): string {
    return column.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

// alias는 createQueryBuilder에 넘긴 하나만 지원한다.
function stripAlias(qualifiedColumn: string, alias: string): string {
    const prefix = `${alias}.`;
    if (!qualifiedColumn.startsWith(prefix)) {
        throw new Error(`in-memory 쿼리빌더 대역은 "${alias}" 외 alias를 지원하지 않는다: ${qualifiedColumn}`);
    }
    return qualifiedColumn.slice(prefix.length);
}

function toComparable(value: unknown): number | string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") {
        // bigint 컬럼은 숫자 문자열로 들어오므로 사전식이 아니라 수치로 비교한다.
        if (/^-?\d+$/.test(value)) return Number(value);
        const timestamp = Date.parse(value);
        return !Number.isNaN(timestamp) && /^\d{4}-\d{2}-\d{2}T/.test(value) ? timestamp : value;
    }
    return value as number;
}

// AND/OR/괄호와 비교 연산자, IS [NOT] NULL만 지원하는 최소 WHERE절 평가기다.
function evaluateCondition<T extends ObjectLiteral>(condition: string, row: T, params: Record<string, unknown>, alias: string): boolean {
    const isNotNull = /^(\w+)\.(\w+)\s+IS\s+NOT\s+NULL$/i.exec(condition);
    if (isNotNull) return toComparable(row[toCamel(stripAlias(`${isNotNull[1]}.${isNotNull[2]}`, alias)) as keyof T]) !== null;

    const isNull = /^(\w+)\.(\w+)\s+IS\s+NULL$/i.exec(condition);
    if (isNull) return toComparable(row[toCamel(stripAlias(`${isNull[1]}.${isNull[2]}`, alias)) as keyof T]) === null;

    const comparison = /^(\w+)\.(\w+)\s*(<=|>=|=|<|>)\s*:(\w+)$/.exec(condition);
    if (comparison) {
        const [, entityAlias, column, op, paramName] = comparison as unknown as [string, string, string, string, string];
        const left = toComparable(row[toCamel(stripAlias(`${entityAlias}.${column}`, alias)) as keyof T]);
        const right = toComparable(params[paramName]);
        switch (op) {
            case "=":
                return left === right;
            case "<":
                return left !== null && right !== null && left < right;
            case ">":
                return left !== null && right !== null && left > right;
            case "<=":
                return left !== null && right !== null && left <= right;
            case ">=":
                return left !== null && right !== null && left >= right;
        }
    }
    throw new Error(`in-memory 쿼리빌더 대역이 지원하지 않는 조건절: ${condition}`);
}

function evaluateOr<T extends ObjectLiteral>(source: string, row: T, params: Record<string, unknown>, alias: string): [boolean, string] {
    let [value, rest] = evaluateAnd(source, row, params, alias);
    for (;;) {
        const trimmed = rest.trimStart();
        if (!/^OR\s/i.test(trimmed)) return [value, rest];
        const [right, next] = evaluateAnd(trimmed.slice(2), row, params, alias);
        value = value || right;
        rest = next;
    }
}

function evaluateAnd<T extends ObjectLiteral>(source: string, row: T, params: Record<string, unknown>, alias: string): [boolean, string] {
    let [value, rest] = evaluateAtom(source, row, params, alias);
    for (;;) {
        const trimmed = rest.trimStart();
        if (!/^AND\s/i.test(trimmed)) return [value, rest];
        const [right, next] = evaluateAtom(trimmed.slice(3), row, params, alias);
        value = value && right;
        rest = next;
    }
}

function evaluateAtom<T extends ObjectLiteral>(source: string, row: T, params: Record<string, unknown>, alias: string): [boolean, string] {
    const trimmed = source.trimStart();
    if (trimmed.startsWith("(")) {
        let depth = 0;
        let closeIndex = 0;
        for (let i = 0; i < trimmed.length; i += 1) {
            if (trimmed[i] === "(") depth += 1;
            else if (trimmed[i] === ")") {
                depth -= 1;
                if (depth === 0) {
                    closeIndex = i;
                    break;
                }
            }
        }
        const [value] = evaluateOr(trimmed.slice(1, closeIndex), row, params, alias);
        return [value, trimmed.slice(closeIndex + 1)];
    }
    const boundary = /\sAND\s|\sOR\s/i.exec(trimmed);
    const end = boundary ? boundary.index : trimmed.length;
    return [evaluateCondition(trimmed.slice(0, end).trim(), row, params, alias), trimmed.slice(end)];
}

function evaluateClause<T extends ObjectLiteral>(clause: string, row: T, params: Record<string, unknown>, alias: string): boolean {
    const [value] = evaluateOr(clause, row, params, alias);
    return value;
}

// TypeORM QueryBuilder 대역이며 leftJoin은 조건 평가에 관여하지 않는다.
function makeQueryBuilder<T extends ObjectLiteral>(rows: T[], alias: string) {
    let patch: Partial<T> = {};
    const updateParams: Record<string, unknown> = {};
    const clauses: { clause: string; params: Record<string, unknown> }[] = [];
    const orderKeys: { column: string; direction: "ASC" | "DESC" }[] = [];
    let limitCount: number | undefined;

    const pushClause = (clause: string, params?: Record<string, unknown>) => {
        clauses.push({ clause, params: params ?? {} });
        Object.assign(updateParams, params ?? {});
    };

    const builder = {
        update: () => builder,
        set: (values: Partial<T>) => {
            patch = values;
            return builder;
        },
        where: (clause: string, params?: Record<string, unknown>) => {
            pushClause(clause, params);
            return builder;
        },
        andWhere: (clause: string, params?: Record<string, unknown>) => {
            pushClause(clause, params);
            return builder;
        },
        orderBy: (column: string, direction: "ASC" | "DESC") => {
            orderKeys.length = 0;
            orderKeys.push({ column: stripAlias(column, alias), direction });
            return builder;
        },
        addOrderBy: (column: string, direction: "ASC" | "DESC") => {
            orderKeys.push({ column: stripAlias(column, alias), direction });
            return builder;
        },
        limit: (count: number) => {
            limitCount = count;
            return builder;
        },
        leftJoin: () => builder,
        execute: () => {
            const id = updateParams["id"];
            const statusSet = Object.values(updateParams).find((v) => Array.isArray(v)) as unknown[] | undefined;
            let affected = 0;
            for (const row of rows) {
                if (id !== undefined && row["id" as keyof T] !== id) continue;
                if (statusSet !== undefined && !statusSet.includes(row["status" as keyof T])) continue;
                Object.assign(row, patch);
                affected += 1;
            }
            return Promise.resolve({ affected, raw: [], generatedMaps: [] });
        },
        getMany: () => {
            const matched = rows.filter((row) => clauses.every(({ clause, params }) => evaluateClause(clause, row, params, alias)));
            const ordered = [...matched].sort((a, b) => {
                for (const { column, direction } of orderKeys) {
                    const av = toComparable(a[toCamel(column) as keyof T]);
                    const bv = toComparable(b[toCamel(column) as keyof T]);
                    if (av === bv) continue;
                    const cmp = (av as string | number) > (bv as string | number) ? 1 : -1;
                    return direction === "DESC" ? -cmp : cmp;
                }
                return 0;
            });
            const limited = limitCount !== undefined ? ordered.slice(0, limitCount) : ordered;
            return Promise.resolve(limited.map(cloneRow));
        },
    };
    return builder;
}

export function createInMemoryRepository<T extends ObjectLiteral>(): InMemoryRepository<T> {
    let rows: T[] = [];

    return {
        seed(...entities: T[]) {
            rows = [...rows, ...entities];
        },
        createQueryBuilder: ((alias?: string) => makeQueryBuilder(rows, alias ?? "t")) as unknown as Repository<T>["createQueryBuilder"],
        all() {
            return [...rows];
        },
        snapshot() {
            return rows.map(cloneRow);
        },
        restore(snapshot: T[]) {
            rows = snapshot.map(cloneRow);
        },
        // 읽기는 복제본을 주므로 조회한 엔티티를 바꿔도 저장된 행은 그대로다.
        find: ((options?: { where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]; order?: FindOptionsOrder<T>; take?: number }) => {
            const filtered = options?.where ? rows.filter((row) => matchesWhere(row, options.where as FindOptionsWhere<T> | FindOptionsWhere<T>[])) : rows;
            const ordered = sorted(filtered, options?.order).map(cloneRow);
            return Promise.resolve(options?.take !== undefined ? ordered.slice(0, options.take) : ordered);
        }),
        findOne: ((options: { where: FindOptionsWhere<T>; order?: FindOptionsOrder<T> }) => {
            const filtered = rows.filter((row) => matches(row, options.where));
            const found = sorted(filtered, options.order)[0];
            return Promise.resolve(found === undefined ? null : cloneRow(found));
        }),
        count: ((options?: { where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] }) => {
            const filtered = options?.where ? rows.filter((row) => matchesWhere(row, options.where as FindOptionsWhere<T> | FindOptionsWhere<T>[])) : rows;
            return Promise.resolve(filtered.length);
        }),
        upsert: ((entityOrEntities: T | T[], conflictKeys: (keyof T & string)[]) => {
            const incoming = Array.isArray(entityOrEntities) ? entityOrEntities : [entityOrEntities];
            for (const entity of incoming) {
                const idx = rows.findIndex((row) => conflictKeys.every((key) => row[key] === entity[key]));
                if (idx >= 0) rows[idx] = entity;
                else rows.push(entity);
            }
            return Promise.resolve({ identifiers: [], generatedMaps: [], raw: [] });
        }),
        delete: ((criteria: FindOptionsWhere<T>) => {
            const before = rows.length;
            rows = rows.filter((row) => !matches(row, criteria));
            const affected = before - rows.length;
            return Promise.resolve({ affected, raw: {} } as DeleteResult);
        }),
    };
}

/** 부분 구현 대역을 Repository 생성자에 넘길 수 있도록 좁힌다. */
export function asRepository<T extends ObjectLiteral>(fake: InMemoryRepository<T>): Repository<T> {
    return fake as unknown as Repository<T>;
}
