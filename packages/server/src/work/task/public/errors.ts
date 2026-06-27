/**
 * 공개 에러 — 플랫폼 예외 필터 등 모듈 밖에서 참조한다. 내부 common/task.errors 는
 * 내부로 유지.
 */
export {
    TaskNotFoundError,
    TaskAlreadyArchivedError,
    TaskNotArchivedError,
    TaskHasNoEventsError,
} from "../common/task.errors.js";
