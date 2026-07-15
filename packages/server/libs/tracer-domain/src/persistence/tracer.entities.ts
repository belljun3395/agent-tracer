import { TaskCleanupSuggestionEntity } from "../cleanup/task.cleanup.suggestion.entity.js";
import { DaemonHealthEntity } from "../daemon/daemon.health.entity.js";
import { AiJobEntity } from "../job/ai.job.entity.js";
import { AiJobStepEntity } from "../job/ai.job.step.entity.js";
import { AgentCompletionInboxEntity } from "../job/agent.completion.inbox.entity.js";
import { RecipeApplicationEntity } from "../recipe/application/recipe.application.entity.js";
import { RecipeEntity } from "../recipe/recipe.entity.js";
import { RuleEntity } from "../rule/rule.entity.js";
import { VerdictEntity } from "../rule/verification/verdict.entity.js";
import { SearchOutboxEntity } from "../search/search.outbox.entity.js";
import { AppSettingEntity } from "../settings/app.setting.entity.js";
import { SessionEntity } from "../task/session/session.entity.js";
import { TaskEntity } from "../task/task.entity.js";
import { TaskUserStateEntity } from "../task/user-state/task.user.state.entity.js";
import { FileAffinityEntity } from "../timeline/affinity/file.affinity.entity.js";
import { EventEntity } from "../timeline/event/event.entity.js";
import { TurnEntity } from "../timeline/turn/turn.entity.js";
import { UserEntity } from "../user/user.entity.js";

// DataSource 등록용 전체 엔티티 목록.
export const TRACER_ENTITIES = [
    TaskEntity,
    TaskUserStateEntity,
    SessionEntity,
    EventEntity,
    TurnEntity,
    FileAffinityEntity,
    RuleEntity,
    VerdictEntity,
    RecipeEntity,
    RecipeApplicationEntity,
    TaskCleanupSuggestionEntity,
    AiJobEntity,
    AiJobStepEntity,
    AgentCompletionInboxEntity,
    UserEntity,
    AppSettingEntity,
    SearchOutboxEntity,
    DaemonHealthEntity,
];
