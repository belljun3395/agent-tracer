export interface CreateRuleCommandUseCaseIn {
  readonly pattern: string;
  readonly label: string;
  readonly taskId?: string;
}

export interface CreateRuleCommandUseCaseOut {
  readonly id: string;
  readonly pattern: string;
  readonly label: string;
  readonly taskId?: string;
  readonly createdAt: string;
}
