import { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let toastId = 0;
const listeners = new Set<(toasts: ToastItem[]) => void>();
let state: ToastItem[] = [];

function emit() {
  for (const fn of listeners) fn(state);
}

/** Imperative API — call from anywhere: `bdToast.push("Overlay connected", "success")`. */
export const bdToast = {
  push(message: string, variant: ToastVariant = "info", duration = 3200): number {
    const id = ++toastId;
    state = [...state, { id, message, variant }];
    emit();
    if (duration) {
      setTimeout(() => {
        state = state.filter((t) => t.id !== id);
        emit();
      }, duration);
    }
    return id;
  },
  dismiss(id: number) {
    state = state.filter((t) => t.id !== id);
    emit();
  },
};

export interface ToastManagerProps {
  className?: string;
}

/** Mount once near the root. Renders whatever `bdToast.push()` queues, stacked bottom-right. */
export function ToastManager({ className = "" }: ToastManagerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>(state);
  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);
  return (
    <div className={`bd-toast-stack ${className}`.trim()}>
      {toasts.map((t) => (
        <div key={t.id} className={`bd-toast bd-toast-${t.variant}`} onClick={() => bdToast.dismiss(t.id)} style={{ cursor: "pointer" }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
