import { JOB_KIND } from "../job/job.const.js";

/** 텔레메트리 이름과 실행 백엔드 라우트가 파생되는, 에이전트의 배포 단위 경계 식별자다. */
export const AGENT = {
    recipeScan: { id: "recipe-scan", jobKind: JOB_KIND.recipeScan, route: "/agents/recipe-scan" },
    taskCleanup: { id: "task-cleanup", jobKind: JOB_KIND.taskCleanup, route: "/agents/task-cleanup" },
    titleSuggestion: {
        id: "title-suggestion",
        jobKind: JOB_KIND.titleSuggestion,
        route: "/agents/title-suggestion",
    },
} as const;

export type AgentId = (typeof AGENT)[keyof typeof AGENT]["id"];
