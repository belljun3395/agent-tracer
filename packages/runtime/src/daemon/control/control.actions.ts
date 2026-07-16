import type {AgentTracerPaths} from "~runtime/config/home.paths.js";
import {purgeDeadLetter, requeueDeadLetter} from "~runtime/config/dead.letter.js";
import type {DaemonSettings} from "~runtime/config/daemon.settings.js";
import type {MonitorIdentity} from "~runtime/config/monitor.identity.js";
import {isRecord} from "~runtime/support/json.js";
import type {ControlSnapshot} from "~runtime/daemon/control/control.state.js";

/** 검증을 마친 폼 값이며 http 계층이 이미 범위를 확인했다. */
export interface ConfigUpdateInput {
    readonly userId: string;
    readonly baseUrl: string;
    readonly daemon: DaemonSettings;
}

/** 파일에 쓴 뒤 다시 해석한 값이며 화면이 저장 직후 보여줄 실제 값이다. */
export interface ConfigUpdateResult {
    readonly identity: MonitorIdentity;
    readonly daemon: DaemonSettings;
}

/** 제어 화면이 호출하는 데몬 조작 포트이며 `updateConfig`는 카탈로그 밖 전용 dispatch 분기로만 호출된다. */
export interface ControlActions {
    readonly snapshot: () => ControlSnapshot;
    readonly flush: () => void;
    readonly resetBackoff: () => void;
    readonly refreshCaches: () => void;
    readonly restart: () => void;
    readonly stop: () => void;
    readonly updateConfig: (input: ConfigUpdateInput) => ConfigUpdateResult;
}

/** 카탈로그 핸들러가 요청을 처리하는 데 필요한 데몬 자원이다. */
export interface ControlActionContext {
    readonly actions: ControlActions;
    readonly paths: AgentTracerPaths;
    readonly readBody: () => Promise<string>;
    readonly defer: (run: () => void) => void;
}

/** 제어 화면 탭 하나에 붙는 액션 버튼이자 그 서버 핸들러다. */
export interface ControlAction {
    readonly label: string;
    readonly tab: string;
    readonly tone: "" | "primary" | "danger";
    readonly confirm?: string;
    /** 성공 토스트 문구다. */
    readonly toast: string;
    readonly run: (context: ControlActionContext) => unknown;
}

function parseRequeueFilter(body: string): {kinds?: readonly string[]} {
    if (body.trim().length === 0) return {};
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return {};
    const kinds = parsed["kinds"];
    if (!Array.isArray(kinds)) return {};
    const selected = kinds.filter((kind): kind is string => typeof kind === "string" && kind.length > 0);
    return selected.length > 0 ? {kinds: selected} : {};
}

/** 각 키가 곧 `/api/v1/control/<키>` 경로다. */
export const CONTROL_ACTIONS = {
    "flush": {
        label: "Flush now",
        tab: "spool",
        tone: "primary",
        toast: "Flushing now",
        run: ({actions}) => {
            actions.flush();
            return {ok: true};
        },
    },
    "reset-backoff": {
        label: "Clear backoff",
        tab: "spool",
        tone: "",
        toast: "Backoff cleared",
        run: ({actions}) => {
            actions.resetBackoff();
            return {ok: true};
        },
    },
    "dead-letter/requeue": {
        label: "Requeue all",
        tab: "dead",
        tone: "",
        toast: "Requeued",
        run: async ({actions, paths, readBody}) => {
            const result = requeueDeadLetter(parseRequeueFilter(await readBody()), paths);
            actions.flush();
            return {ok: true, data: result};
        },
    },
    "dead-letter/purge": {
        label: "Purge all",
        tab: "dead",
        tone: "danger",
        confirm: "Delete every dead-lettered event? This cannot be undone.",
        toast: "Purged",
        run: ({paths}) => ({ok: true, data: purgeDeadLetter(paths)}),
    },
    "refresh-caches": {
        label: "Refresh now",
        tab: "caches",
        tone: "",
        toast: "Refreshing caches",
        run: ({actions}) => {
            actions.refreshCaches();
            return {ok: true};
        },
    },
    "restart": {
        label: "Restart daemon",
        tab: "lifecycle",
        tone: "primary",
        toast: "Restarting, a hook call will bring it back",
        run: ({actions, defer}) => {
            defer(() => actions.restart());
            return {ok: true};
        },
    },
    "stop": {
        label: "Stop daemon",
        tab: "lifecycle",
        tone: "danger",
        confirm: "Stop the daemon? Hooks will respawn it on the next call.",
        toast: "Stopping",
        run: ({actions, defer}) => {
            defer(() => actions.stop());
            return {ok: true};
        },
    },
} satisfies Record<string, ControlAction>;

export type ControlActionKey = keyof typeof CONTROL_ACTIONS;

/** 카탈로그에 없는 키는 미지 경로다. */
export function findControlAction(key: string): ControlAction | undefined {
    return (CONTROL_ACTIONS as Record<string, ControlAction>)[key];
}
