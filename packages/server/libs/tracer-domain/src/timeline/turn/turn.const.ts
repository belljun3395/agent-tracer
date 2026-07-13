export const TURN_STATUS = {
    open: "open",
    closed: "closed",
} as const;

export const TURN_STATUSES = [TURN_STATUS.open, TURN_STATUS.closed] as const;

export type TurnStatus = (typeof TURN_STATUSES)[number];
