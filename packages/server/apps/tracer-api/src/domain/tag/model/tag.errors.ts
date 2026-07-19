import { DomainError } from "@monitor/platform";

/** 같은 사용자 안에 이미 살아 있는 동명 태그가 있어 새로 만들거나 이름을 바꿀 수 없음을 알린다. */
export class TagNameConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "tag.name-conflict";

    constructor(name: string) {
        super(`Tag name "${name}" is already in use`);
    }
}
