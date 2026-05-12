import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface Toast {
  readonly id: string;
  readonly tone: ToastTone;
  readonly title: string;
  readonly body?: string;
  readonly createdAtMs: number;
}

export interface ToastInput {
  readonly tone: ToastTone;
  readonly title: string;
  readonly body?: string;
  /** Override auto-dismiss timeout in ms. Set to 0 to disable auto-dismiss. */
  readonly autoDismissMs?: number;
}

interface ToastState {
  readonly toasts: readonly Toast[];
  readonly push: (input: ToastInput) => string;
  readonly dismiss: (id: string) => void;
  readonly clear: () => void;
}

const DEFAULT_AUTO_DISMISS_MS = 5_000;

let counter = 0;

function genId(): string {
  counter += 1;
  return `t-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (input) => {
    const id = genId();
    const toast: Toast = {
      id,
      tone: input.tone,
      title: input.title,
      ...(input.body !== undefined ? { body: input.body } : {}),
      createdAtMs: Date.now(),
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    const timeout = input.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS;
    if (timeout > 0) {
      setTimeout(() => {
        if (get().toasts.some((t) => t.id === id)) {
          get().dismiss(id);
        }
      }, timeout);
    }
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
