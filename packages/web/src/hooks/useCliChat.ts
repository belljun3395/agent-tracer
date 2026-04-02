import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createCliWebSocket } from "../api.js";
import type {
  ChatAction,
  ChatMessage,
  ChatSession,
  ChatState,
  CliType,
  CliWsMessage
} from "../types/chat.js";

const SOCKET_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1
} as const;

const RECONNECT_BASE_MS = 100;
const RECONNECT_MAX_MS = 5000;

function createMessage(input: {
  role: ChatMessage["role"];
  content: string;
  isStreaming?: boolean;
  error?: string;
}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: input.role,
    content: input.content,
    timestamp: new Date().toISOString(),
    isStreaming: input.isStreaming ?? false,
    ...(input.error ? { error: input.error } : {})
  };
}

function createSession(input: {
  cli: CliType;
  workdir: string;
  taskId?: string;
  cliSessionId?: string;
  model?: string;
}): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    cli: input.cli,
    workdir: input.workdir,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.cliSessionId ? { cliSessionId: input.cliSessionId } : {}),
    ...(input.model ? { model: input.model } : {}),
    messages: [],
    status: "idle",
    createdAt: now,
    lastActivityAt: now
  };
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "CONNECT":
      return {
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        isConnected: true
      };
    case "DISCONNECT":
      return {
        ...state,
        isConnected: false,
        ...(action.error ? { connectionError: action.error } : {})
      };
    case "CREATE_SESSION": {
      const next = new Map(state.sessions);
      next.set(action.session.id, action.session);
      return {
        ...state,
        sessions: next,
        activeSessionId: action.session.id
      };
    }
    case "SET_ACTIVE_SESSION":
      return { ...state, activeSessionId: action.sessionId };
    case "UPDATE_SESSION_STATUS": {
      const session = state.sessions.get(action.sessionId);
      if (!session) return state;
      const { processId: _processId, ...sessionWithoutProcess } = session;
      const updated: ChatSession = {
        ...sessionWithoutProcess,
        status: action.status,
        ...(action.status === "running" && action.processId !== undefined ? { processId: action.processId } : {}),
        ...(action.status === "starting" && session.processId !== undefined ? { processId: session.processId } : {}),
        ...(action.cliSessionId !== undefined ? { cliSessionId: action.cliSessionId } : {}),
        ...(action.taskId !== undefined ? { taskId: action.taskId } : {}),
        lastActivityAt: new Date().toISOString()
      };
      const next = new Map(state.sessions);
      next.set(action.sessionId, updated);
      return { ...state, sessions: next };
    }
    case "ADD_MESSAGE": {
      const session = state.sessions.get(action.sessionId);
      if (!session) return state;
      const updated: ChatSession = {
        ...session,
        messages: [...session.messages, action.message],
        lastActivityAt: new Date().toISOString()
      };
      const next = new Map(state.sessions);
      next.set(action.sessionId, updated);
      return { ...state, sessions: next };
    }
    case "UPDATE_MESSAGE": {
      const session = state.sessions.get(action.sessionId);
      if (!session) return state;
      const messages = session.messages.map((message) =>
        message.id === action.messageId
          ? {
            ...message,
            content: action.content,
            ...(action.isStreaming !== undefined ? { isStreaming: action.isStreaming } : {})
          }
          : message
      );
      const updated: ChatSession = {
        ...session,
        messages,
        lastActivityAt: new Date().toISOString()
      };
      const next = new Map(state.sessions);
      next.set(action.sessionId, updated);
      return { ...state, sessions: next };
    }
    case "COMPLETE_MESSAGE": {
      const session = state.sessions.get(action.sessionId);
      if (!session) return state;
      const messages = session.messages.map((message) =>
        message.id === action.messageId ? { ...message, isStreaming: false } : message
      );
      const next = new Map(state.sessions);
      next.set(action.sessionId, { ...session, messages, lastActivityAt: new Date().toISOString() });
      return { ...state, sessions: next };
    }
    case "ERROR_MESSAGE": {
      const session = state.sessions.get(action.sessionId);
      if (!session) return state;
      const messages = session.messages.map((message) =>
        message.id === action.messageId ? { ...message, isStreaming: false, error: action.error } : message
      );
      const next = new Map(state.sessions);
      next.set(action.sessionId, { ...session, messages, status: "error", lastActivityAt: new Date().toISOString() });
      return { ...state, sessions: next };
    }
    case "REMOVE_SESSION": {
      const next = new Map(state.sessions);
      next.delete(action.sessionId);
      return {
        ...state,
        sessions: next,
        activeSessionId: state.activeSessionId === action.sessionId ? null : state.activeSessionId
      };
    }
    default:
      return state;
  }
}

const INITIAL_STATE: ChatState = {
  sessions: new Map(),
  activeSessionId: null,
  isConnected: false
};

function findSessionIdByProcessId(sessions: ReadonlyMap<string, ChatSession>, processId: string): string | null {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.processId === processId) {
      return sessionId;
    }
  }
  return null;
}

interface StartSessionInput {
  readonly cli: CliType;
  readonly workdir: string;
  readonly taskId?: string;
  readonly cliSessionId?: string;
  readonly model?: string;
}

export function useCliChat(): {
  state: ChatState;
  activeSession: ChatSession | null;
  createSession: (input: StartSessionInput) => string;
  setActiveSession: (sessionId: string | null) => void;
  sendMessage: (sessionId: string, message: string) => void;
  cancelSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => void;
} {
  const [state, setState] = useState<ChatState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: ChatAction): void => {
    setState((prev) => chatReducer(prev, action));
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const triggerConnectRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pendingSessionQueueRef = useRef<string[]>([]);
  const pendingSessionByRequestIdRef = useRef<Map<string, string>>(new Map());
  const streamMessageRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let destroyed = false;

    const clearReconnectTimer = (): void => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const getReconnectDelay = (): number => {
      const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptsRef.current);
      return Math.min(delay, RECONNECT_MAX_MS);
    };

    const connect = (): void => {
      const ws = createCliWebSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) {
          ws.close();
          return;
        }
        reconnectAttemptsRef.current = 0;
        dispatch({ type: "CONNECT" });
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        if (typeof event.data !== "string") {
          return;
        }
        let payload: CliWsMessage;
        try {
          payload = JSON.parse(event.data) as CliWsMessage;
        } catch {
          // Malformed server message — ignore rather than crash the message loop.
          return;
        }

        if (payload.type === "cli:started" && payload.processId) {
          const sessionId = payload.requestId
            ? pendingSessionByRequestIdRef.current.get(payload.requestId) ?? null
            : pendingSessionQueueRef.current.shift() ?? null;
          if (!sessionId) return;
          if (payload.requestId) {
            pendingSessionByRequestIdRef.current.delete(payload.requestId);
            pendingSessionQueueRef.current = pendingSessionQueueRef.current.filter((id) => id !== sessionId);
          }
          dispatch({
            type: "UPDATE_SESSION_STATUS",
            sessionId,
            status: "running",
            processId: payload.processId,
            ...((payload.sessionId ?? "").trim().length > 0 ? { cliSessionId: payload.sessionId } : {}),
            ...(payload.taskId ? { taskId: payload.taskId } : {})
          });
          return;
        }

        if (payload.type === "cli:stream" && payload.processId) {
          const sessionId = findSessionIdByProcessId(stateRef.current.sessions, payload.processId);
          if (!sessionId) return;

          const content = payload.content ?? "";
          if (!content) return;

          const streamingMessageId = streamMessageRef.current.get(payload.processId);
          if (!streamingMessageId) {
            const assistant = createMessage({ role: "assistant", content, isStreaming: true });
            dispatch({ type: "ADD_MESSAGE", sessionId, message: assistant });
            streamMessageRef.current.set(payload.processId, assistant.id);
            return;
          }

          const session = stateRef.current.sessions.get(sessionId);
          const previous = session?.messages.find((m) => m.id === streamingMessageId)?.content ?? "";
          dispatch({
            type: "UPDATE_MESSAGE",
            sessionId,
            messageId: streamingMessageId,
            content: previous + content,
            isStreaming: true
          });
          return;
        }

        if (payload.type === "cli:complete" && payload.processId) {
          const sessionId = findSessionIdByProcessId(stateRef.current.sessions, payload.processId);
          if (!sessionId) return;

          const streamingMessageId = streamMessageRef.current.get(payload.processId);
          if (streamingMessageId) {
            dispatch({ type: "COMPLETE_MESSAGE", sessionId, messageId: streamingMessageId });
            streamMessageRef.current.delete(payload.processId);
          }

          const exitCode = typeof payload.exitCode === "number" ? payload.exitCode : 0;
          if (exitCode !== 0) {
            const errorMessage = `CLI process exited with code ${exitCode}`;
            dispatch({
              type: "ADD_MESSAGE",
              sessionId,
              message: createMessage({ role: "system", content: errorMessage, error: errorMessage })
            });
            dispatch({ type: "UPDATE_SESSION_STATUS", sessionId, status: "error" });
            return;
          }

          // CLI exited successfully but never produced any visible content —
          // typically an API/model configuration error where OpenCode exits 0.
          if (!streamingMessageId) {
            const fallback = "CLI 프로세스가 응답 없이 종료되었습니다. 모델 설정을 확인해 주세요.";
            dispatch({
              type: "ADD_MESSAGE",
              sessionId,
              message: createMessage({ role: "system", content: fallback, error: fallback })
            });
            dispatch({ type: "UPDATE_SESSION_STATUS", sessionId, status: "error" });
            return;
          }

          dispatch({
            type: "UPDATE_SESSION_STATUS",
            sessionId,
            status: "idle",
            ...((payload.sessionId ?? "").trim().length > 0 ? { cliSessionId: payload.sessionId } : {})
          });
          return;
        }

        if (payload.type === "cli:error") {
          if (!payload.processId) {
            if (!payload.requestId) {
              return;
            }
            const pendingSessionId = pendingSessionByRequestIdRef.current.get(payload.requestId);
            if (!pendingSessionId) {
              return;
            }
            pendingSessionByRequestIdRef.current.delete(payload.requestId);
            pendingSessionQueueRef.current = pendingSessionQueueRef.current.filter((id) => id !== pendingSessionId);
            const errorMessage = payload.error ?? "Failed to start CLI process";
            dispatch({
              type: "ADD_MESSAGE",
              sessionId: pendingSessionId,
              message: createMessage({ role: "system", content: errorMessage, error: errorMessage })
            });
            dispatch({ type: "UPDATE_SESSION_STATUS", sessionId: pendingSessionId, status: "error" });
            return;
          }
          const sessionId = findSessionIdByProcessId(stateRef.current.sessions, payload.processId);
          if (!sessionId) return;
          const errorMessage = payload.error ?? "Unknown CLI error";
          dispatch({
            type: "ADD_MESSAGE",
            sessionId,
            message: createMessage({ role: "system", content: errorMessage, error: errorMessage })
          });
          dispatch({ type: "UPDATE_SESSION_STATUS", sessionId, status: "error" });
          const streamingMessageId = streamMessageRef.current.get(payload.processId);
          if (streamingMessageId) {
            dispatch({ type: "ERROR_MESSAGE", sessionId, messageId: streamingMessageId, error: errorMessage });
            streamMessageRef.current.delete(payload.processId);
          }
        }
      };

      ws.onerror = () => {
        dispatch({ type: "DISCONNECT", error: "WebSocket connection failed" });
      };

      ws.onclose = () => {
        dispatch({ type: "DISCONNECT" });
        pendingSessionQueueRef.current = [];
        pendingSessionByRequestIdRef.current.clear();
        streamMessageRef.current.clear();

        for (const [sessionId, session] of stateRef.current.sessions.entries()) {
          if (session.status === "running" || session.status === "starting" || session.status === "stopping") {
            const interruptionMessage = createMessage({
              role: "system",
              content: "CLI connection was closed. Start again to continue.",
              error: "connection_closed"
            });
            dispatch({ type: "ADD_MESSAGE", sessionId, message: interruptionMessage });
            dispatch({ type: "UPDATE_SESSION_STATUS", sessionId, status: "error" });
          }
        }

        if (destroyed) return;
        const delay = getReconnectDelay();
        reconnectAttemptsRef.current += 1;
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    // Lazily expose connect so the WebSocket is only opened on first session creation.
    triggerConnectRef.current = () => {
      const existing = wsRef.current;
      if (
        !existing
        || (existing.readyState !== SOCKET_READY_STATE.CONNECTING
          && existing.readyState !== SOCKET_READY_STATE.OPEN)
      ) {
        connect();
      }
    };

    return () => {
      destroyed = true;
      triggerConnectRef.current = null;
      clearReconnectTimer();
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === SOCKET_READY_STATE.CONNECTING) {
          setTimeout(() => ws.close(), 0);
        } else {
          ws.close();
        }
      }
    };
  }, [dispatch]);

  const createSessionHandler = useCallback((input: StartSessionInput): string => {
    const session = createSession(input);
    dispatch({ type: "CREATE_SESSION", session });
    triggerConnectRef.current?.();
    return session.id;
  }, [dispatch]);

  const setActiveSession = useCallback((sessionId: string | null): void => {
    dispatch({ type: "SET_ACTIVE_SESSION", sessionId });
  }, [dispatch]);

  const sendMessage = useCallback((sessionId: string, message: string): void => {
    const session = stateRef.current.sessions.get(sessionId);
    const ws = wsRef.current;
    if (!session || !ws || ws.readyState !== SOCKET_READY_STATE.OPEN) {
      return;
    }
    // Guard: don't send a new cli:start while a previous start is still in flight.
    if (session.status === "starting") {
      return;
    }

    dispatch({ type: "ADD_MESSAGE", sessionId, message: createMessage({ role: "user", content: message }) });

    if (session.processId) {
      ws.send(JSON.stringify({ type: "cli:message", processId: session.processId, message }));
      return;
    }

    dispatch({ type: "UPDATE_SESSION_STATUS", sessionId, status: "starting" });
    const requestId = crypto.randomUUID();
    pendingSessionQueueRef.current.push(sessionId);
    pendingSessionByRequestIdRef.current.set(requestId, sessionId);

    if (session.cliSessionId) {
      ws.send(JSON.stringify({
        type: "cli:resume",
        requestId,
        cli: session.cli,
        sessionId: session.cliSessionId,
        workdir: session.workdir,
        prompt: message,
        ...(session.taskId ? { taskId: session.taskId } : {}),
        ...(session.model ? { model: session.model } : {})
      }));
      return;
    }

    ws.send(JSON.stringify({
      type: "cli:start",
      requestId,
      cli: session.cli,
      workdir: session.workdir,
      prompt: message,
      ...(session.taskId ? { taskId: session.taskId } : {}),
      ...(session.model ? { model: session.model } : {})
    }));
  }, [dispatch]);

  const cancelSession = useCallback((sessionId: string): void => {
    const session = stateRef.current.sessions.get(sessionId);
    const ws = wsRef.current;
    if (!session?.processId || !ws || ws.readyState !== SOCKET_READY_STATE.OPEN) {
      return;
    }

    dispatch({ type: "UPDATE_SESSION_STATUS", sessionId, status: "stopping" });
    ws.send(JSON.stringify({ type: "cli:cancel", processId: session.processId }));
  }, [dispatch]);

  const closeSession = useCallback((sessionId: string): void => {
    const session = stateRef.current.sessions.get(sessionId);
    if (session?.status === "starting") {
      return;
    }
    if (session?.processId) {
      cancelSession(sessionId);
    }
    dispatch({ type: "REMOVE_SESSION", sessionId });
  }, [cancelSession, dispatch]);

  const activeSession = useMemo(
    () => (state.activeSessionId ? state.sessions.get(state.activeSessionId) ?? null : null),
    [state.activeSessionId, state.sessions]
  );

  return {
    state,
    activeSession,
    createSession: createSessionHandler,
    setActiveSession,
    sendMessage,
    cancelSession,
    closeSession
  };
}
