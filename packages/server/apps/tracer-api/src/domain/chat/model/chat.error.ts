/** 아직 배선되지 않은 실행 백엔드가 대화 턴을 요청받았을 때 던지는 도메인 오류다. */
export class ChatBackendNotImplementedError extends Error {
    constructor(backend: string) {
        super(`chat backend '${backend}' is not implemented`);
        this.name = "ChatBackendNotImplementedError";
    }
}
