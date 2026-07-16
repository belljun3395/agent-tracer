/** 인메모리 대역이 저장된 행과 조회 결과를 분리하려고 프로토타입을 유지한 채 복제한다. */
export function cloneRow<T extends object>(row: T): T {
    return Object.assign(Object.create(Object.getPrototypeOf(row) as object) as T, row);
}
