import { NOTIFICATION_TYPE, type NotificationEnvelope, type NotificationType } from "@monitor/kernel";
import {
    EventPresentation,
    TaskView,
    type EventEntity,
    type TaskEntity,
    type TurnEntity,
} from "@monitor/tracer-domain";

function asPayload(value: object): Record<string, unknown> {
    return value as Record<string, unknown>;
}

export function taskNotification(type: NotificationType, task: TaskEntity): NotificationEnvelope {
    return { userId: task.userId, notification: { type, payload: asPayload(new TaskView(task, null).toListItem()) } };
}

export function eventNotification(userId: string, event: EventEntity): NotificationEnvelope {
    return {
        userId,
        notification: { type: NOTIFICATION_TYPE.eventLogged, payload: asPayload(new EventPresentation(event).toTimelineItem()) },
    };
}

export function sessionNotification(
    type: NotificationType,
    userId: string,
    taskId: string,
    sessionId: string,
): NotificationEnvelope {
    return { userId, notification: { type, payload: { taskId, sessionId } } };
}

export function verdictNotification(userId: string, turn: TurnEntity): NotificationEnvelope {
    return {
        userId,
        notification: {
            type: NOTIFICATION_TYPE.verdictUpdated,
            payload: {
                taskId: turn.taskId,
                turnId: turn.id,
                aggregateVerdict: turn.aggregateVerdict,
                rulesEvaluatedCount: turn.rulesEvaluatedCount,
            },
        },
    };
}
