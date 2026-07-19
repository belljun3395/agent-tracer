import type { DataSource, EntityManager } from "typeorm";
import { TaskCleanupSuggestionEntity } from "../cleanup/task.cleanup.suggestion.entity.js";
import { TaskCleanupSuggestionRepository } from "../cleanup/task.cleanup.suggestion.repository.js";
import { AiJobEntity } from "../job/ai.job.entity.js";
import { AiJobRepository } from "../job/ai.job.repository.js";
import { AiJobStepEntity } from "../job/ai.job.step.entity.js";
import { AiJobStepRepository } from "../job/ai.job.step.repository.js";
import { MemoEntity } from "../memo/memo.entity.js";
import { MemoRepository } from "../memo/memo.repository.js";
import { TagEntity } from "../tag/tag.entity.js";
import { TagRepository } from "../tag/tag.repository.js";
import { TaskTagEntity } from "../tag/task-tag.entity.js";
import { TaskTagRepository } from "../tag/task-tag.repository.js";
import { RecipeEntity } from "../recipe/recipe.entity.js";
import { RecipeRepository } from "../recipe/recipe.repository.js";
import { RuleEntity } from "../rule/rule.entity.js";
import { RuleRepository } from "../rule/rule.repository.js";
import { SearchOutboxEntity } from "../search/search.outbox.entity.js";
import { SearchOutboxRepository } from "../search/search.outbox.repository.js";
import { TaskEntity } from "../task/task.entity.js";
import { TaskRepository } from "../task/task.repository.js";
import { TaskUserStateEntity } from "../task/user-state/task.user.state.entity.js";
import { TaskUserStateRepository } from "../task/user-state/task.user.state.repository.js";

// 한 트랜잭션 안에서만 유효한 저장소 묶음이며, 잡 종결과 그 부수효과를 한 커밋으로 묶어 전이 경합에서 진 실행자가 부수효과를 남기지 않게 한다.
export interface TracerTx {
    readonly jobs: AiJobRepository;
    readonly jobSteps: AiJobStepRepository;
    readonly recipes: RecipeRepository;
    readonly rules: RuleRepository;
    readonly cleanupSuggestions: TaskCleanupSuggestionRepository;
    readonly tasks: TaskRepository;
    readonly taskUserStates: TaskUserStateRepository;
    readonly searchOutbox: SearchOutboxRepository;
    readonly memos: MemoRepository;
    readonly tags: TagRepository;
    readonly taskTags: TaskTagRepository;
}

function bind(manager: EntityManager): TracerTx {
    return {
        jobs: new AiJobRepository(manager.getRepository(AiJobEntity)),
        jobSteps: new AiJobStepRepository(manager.getRepository(AiJobStepEntity)),
        recipes: new RecipeRepository(manager.getRepository(RecipeEntity)),
        rules: new RuleRepository(manager.getRepository(RuleEntity)),
        cleanupSuggestions: new TaskCleanupSuggestionRepository(manager.getRepository(TaskCleanupSuggestionEntity)),
        tasks: new TaskRepository(manager.getRepository(TaskEntity)),
        taskUserStates: new TaskUserStateRepository(manager.getRepository(TaskUserStateEntity)),
        searchOutbox: new SearchOutboxRepository(manager.getRepository(SearchOutboxEntity)),
        memos: new MemoRepository(manager.getRepository(MemoEntity)),
        tags: new TagRepository(manager.getRepository(TagEntity)),
        taskTags: new TaskTagRepository(manager.getRepository(TaskTagEntity)),
    };
}

// 저장소가 생성자로 Repository를 받으므로 트랜잭션 매니저의 Repository로 같은 클래스를 다시 만들며, 암묵 전파 없이 어떤 쓰기가 트랜잭션 안인지 호출부에서 그대로 보인다.
export class TransactionRunner {
    constructor(private readonly dataSource: DataSource) {}

    async run<T>(work: (tx: TracerTx) => Promise<T>): Promise<T> {
        return this.dataSource.transaction((manager) => work(bind(manager)));
    }
}
