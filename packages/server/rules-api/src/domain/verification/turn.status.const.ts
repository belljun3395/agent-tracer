export const TURN_STATUS = {
    open: "open",
    closed: "closed",
} as const;

export const TURN_STATUSES = [TURN_STATUS.open, TURN_STATUS.closed] as const;

export type TurnStatus = (typeof TURN_STATUSES)[number];

// 아직 닫히지 않아 평가/백필 대상인 턴.
export function isOpenTurn(turn: { readonly status: TurnStatus }): boolean {
    return turn.status === TURN_STATUS.open;
}
