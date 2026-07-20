import { normalizeAiAgentBackend } from "@monitor/kernel";
import { SystemClock } from "@monitor/platform";
import {
    AiJobRepository,
    AiJobStepRepository,
    AppSettingRepository,
    EventRepository,
    RuleRepository,
    TransactionRunner,
    TurnRepository,
    VerdictRepository,
} from "@monitor/tracer-domain";
import { CancelJobUseCase } from "~tracer-api/domain/job/application/command/cancel.job.usecase.js";
import { EnqueueJobUseCase } from "~tracer-api/domain/job/application/command/enqueue.job.usecase.js";
import { FailJobUseCase } from "~tracer-api/domain/job/application/command/fail.job.usecase.js";
import { ReleaseJobUseCase } from "~tracer-api/domain/job/application/command/release.job.usecase.js";
import { RenewJobLeaseUseCase } from "~tracer-api/domain/job/application/command/renew.job.lease.usecase.js";
import { StartJobUseCase } from "~tracer-api/domain/job/application/command/start.job.usecase.js";
import { SubmitJobResultsUseCase } from "~tracer-api/domain/job/application/command/submit.job.results.usecase.js";
import { GetJobStepsUseCase } from "~tracer-api/domain/job/application/query/get.job.steps.usecase.js";
import { GetJobUseCase } from "~tracer-api/domain/job/application/query/get.job.usecase.js";
import { GetLatestJobUseCase } from "~tracer-api/domain/job/application/query/get.latest.job.usecase.js";
import { ListJobHistoryUseCase } from "~tracer-api/domain/job/application/query/list.job.history.usecase.js";
import { ListPendingJobsUseCase } from "~tracer-api/domain/job/application/query/list.pending.jobs.usecase.js";
import { RuleBackfillService } from "~tracer-api/domain/job/application/rule.backfill.service.js";
import { RuleGenerationResultService } from "~tracer-api/domain/job/application/rule.generation.result.service.js";
import { WorkflowDispatcher } from "~tracer-api/domain/job/adapter/workflow.dispatcher.js";
import { WsJobStatusNotifier } from "~tracer-api/domain/job/adapter/job.status.notifier.js";
import { StructuredJobEventLogAdapter } from "~tracer-api/domain/job/adapter/structured.job.event.log.adapter.js";
import { JobCommandController } from "~tracer-api/domain/job/inbound/job.command.controller.js";
import { JobExecutionController } from "~tracer-api/domain/job/inbound/job.execution.controller.js";
import { JobQueryController } from "~tracer-api/domain/job/inbound/job.query.controller.js";
import { DEFAULT_AGENT_BACKEND } from "~tracer-api/domain/job/port/agent.backend.port.js";
import { AI_JOB_REPOSITORY } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { AI_JOB_STEP_REPOSITORY } from "~tracer-api/domain/job/port/ai.job.step.repository.port.js";
import { CLOCK } from "~tracer-api/domain/job/port/clock.port.js";
import { JOB_EVENT_LOG } from "~tracer-api/domain/job/port/job.event.log.port.js";
import { JOB_STATUS_NOTIFIER } from "~tracer-api/domain/job/port/job.status.notifier.port.js";
import { RULE_EVENT_READER } from "~tracer-api/domain/job/port/rule-verification/event.reader.port.js";
import { RULE_REPOSITORY } from "~tracer-api/domain/job/port/rule-verification/rule.repository.port.js";
import { RULE_TURN_REPOSITORY } from "~tracer-api/domain/job/port/rule-verification/turn.repository.port.js";
import { RULE_VERDICT_REPOSITORY } from "~tracer-api/domain/job/port/rule-verification/verdict.repository.port.js";
import { SETTING_READER } from "~tracer-api/domain/job/port/setting.reader.port.js";
import { JOB_TRANSACTION } from "~tracer-api/domain/job/port/transaction.port.js";
import { WORKFLOW_DISPATCHER } from "~tracer-api/domain/job/port/workflow.dispatcher.port.js";

/** job 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const jobFeature = {
    controllers: [JobQueryController, JobCommandController, JobExecutionController],
    providers: [
        CancelJobUseCase,
        EnqueueJobUseCase,
        FailJobUseCase,
        ReleaseJobUseCase,
        RenewJobLeaseUseCase,
        StartJobUseCase,
        SubmitJobResultsUseCase,
        GetJobStepsUseCase,
        GetJobUseCase,
        GetLatestJobUseCase,
        ListJobHistoryUseCase,
        ListPendingJobsUseCase,
        RuleBackfillService,
        RuleGenerationResultService,
        WorkflowDispatcher,
        WsJobStatusNotifier,
        StructuredJobEventLogAdapter,
        { provide: JOB_EVENT_LOG, useExisting: StructuredJobEventLogAdapter },
        { provide: CLOCK, useClass: SystemClock },
        { provide: DEFAULT_AGENT_BACKEND, useFactory: () => normalizeAiAgentBackend(process.env["AGENT_BACKEND"]) },
        { provide: AI_JOB_REPOSITORY, useExisting: AiJobRepository },
        { provide: AI_JOB_STEP_REPOSITORY, useExisting: AiJobStepRepository },
        { provide: SETTING_READER, useExisting: AppSettingRepository },
        { provide: JOB_TRANSACTION, useExisting: TransactionRunner },
        { provide: JOB_STATUS_NOTIFIER, useExisting: WsJobStatusNotifier },
        { provide: WORKFLOW_DISPATCHER, useExisting: WorkflowDispatcher },
        { provide: RULE_EVENT_READER, useExisting: EventRepository },
        { provide: RULE_REPOSITORY, useExisting: RuleRepository },
        { provide: RULE_TURN_REPOSITORY, useExisting: TurnRepository },
        { provide: RULE_VERDICT_REPOSITORY, useExisting: VerdictRepository },
    ],
};
