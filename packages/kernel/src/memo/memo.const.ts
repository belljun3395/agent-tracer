export const MEMO_AUTHOR = {
    human: "human",
    agent: "agent",
} as const;

export const MEMO_AUTHORS = [MEMO_AUTHOR.human, MEMO_AUTHOR.agent] as const;

export type MemoAuthor = (typeof MEMO_AUTHORS)[number];
