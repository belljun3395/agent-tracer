import { JOB_KIND } from "../job/job.const.js";

/** 텔레메트리 이름과 실행 백엔드 라우트가 파생되는 에이전트의 배포 단위 경계 식별자이며, 잡 에이전트는 jobKind를 갖고 chat 같은 대화 에이전트는 갖지 않는다. */
export const AGENT = {
    recipeScan: { id: "recipe-scan", jobKind: JOB_KIND.recipeScan, route: "/agents/recipe-scan" },
    taskCleanup: { id: "task-cleanup", jobKind: JOB_KIND.taskCleanup, route: "/agents/task-cleanup" },
    titleSuggestion: {
        id: "title-suggestion",
        jobKind: JOB_KIND.titleSuggestion,
        route: "/agents/title-suggestion",
    },
    chat: { id: "chat", route: "/agents/chat" },
} as const;

export type AgentId = (typeof AGENT)[keyof typeof AGENT]["id"];

/** 한 태스크가 서로 다른 작업 turn을 담을 수 있어 recipe-scan 한 번이 낼 수 있는 후보 수다. */
export const RECIPE_CANDIDATE_LIMIT = 4;
