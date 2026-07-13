import { DomainError } from "@monitor/platform";

// 단일 엔티티나 도메인 협력의 불변식 위반이며 code는 위반한 규칙의 식별자다.
export class InvariantViolationError extends DomainError {
    readonly httpStatus: number;

    readonly code: string;

    constructor(code: string, httpStatus = 409) {
        super(code);
        this.code = code;
        this.httpStatus = httpStatus;
    }
}
