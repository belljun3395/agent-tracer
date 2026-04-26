export interface ListRuleCommandsUseCaseIn {
  readonly taskId?: string;
}

export interface ListedRuleCommandUseCaseDto {
  readonly id: string;
  readonly pattern: string;
  readonly label: string;
  readonly taskId?: string;
  readonly createdAt: string;
}

export type ListRuleCommandsUseCaseOut = readonly ListedRuleCommandUseCaseDto[];
