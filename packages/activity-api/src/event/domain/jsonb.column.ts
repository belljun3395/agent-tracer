import type { ValueTransformer } from "typeorm";
import type { ZodType } from "zod";

/**
 * jsonb 컬럼이 "아무거나" 담지 않도록, 저장 직전 zod 스키마로 검증하는 TypeORM
 * 트랜스포머. 스키마에 맞지 않으면 저장이 throw 된다(앱 경계에서 차단).
 */
export function zodJsonbTransformer<T>(schema: ZodType<T>): ValueTransformer {
    return {
        to: (value: T): T => schema.parse(value),
        from: (value: unknown): T => schema.parse(value),
    };
}
