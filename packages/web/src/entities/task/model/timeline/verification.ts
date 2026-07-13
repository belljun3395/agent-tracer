export interface TaskVerification {
  readonly id: string;
  readonly taskId: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly turnId: string;
  readonly evaluatedAt: string;
  readonly triggerEventId?: string;
  readonly matchedEventIds: readonly string[];
}
