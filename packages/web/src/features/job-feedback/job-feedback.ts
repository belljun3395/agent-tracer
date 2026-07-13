export type JobFeedbackSubject = "result" | "title" | "rule" | "recipe";

export const JOB_FEEDBACK_SUBJECT_LABEL: Readonly<Record<JobFeedbackSubject, string>> = {
  result: "result",
  title: "title suggestion",
  rule: "rule suggestion",
  recipe: "recipe suggestion",
};
