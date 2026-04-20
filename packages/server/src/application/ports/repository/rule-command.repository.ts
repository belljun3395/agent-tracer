export interface RuleCommandRecord {
  readonly id: string;
  readonly pattern: string;
  readonly label: string;
  readonly taskId?: string;
  readonly createdAt: string;
}

export interface RuleCommandCreateInput {
  readonly id: string;
  readonly pattern: string;
  readonly label: string;
  readonly taskId?: string;
}

export interface IRuleCommandRepository {
  create(input: RuleCommandCreateInput): Promise<RuleCommandRecord>;
  findAll(): Promise<readonly RuleCommandRecord[]>;
  findByTaskId(taskId: string): Promise<readonly RuleCommandRecord[]>;
  findGlobal(): Promise<readonly RuleCommandRecord[]>;
  delete(id: string): Promise<boolean>;
}
