"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "info" | "success";

type ToastInput = {
  title: string;
  description?: string;
  durationMs?: number;
  variant?: ToastVariant;
};

type ToastRecord = ToastInput & {
  id: string;
};

type ToastContextValue = {
  pushToast: (toast: ToastInput) => string;
  dismissToast: (toastId: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (toastId: string) => void;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs ?? 7000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onDismiss, toast.durationMs, toast.id]);

  const toneClassName =
    toast.variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : toast.variant === "info"
        ? "border-sky-200 bg-sky-50 text-sky-950"
        : "border-rose-200 bg-rose-50 text-rose-950";

  return (
    <div className={cn("rounded-[1.4rem] border p-4 shadow-[var(--toast-shadow)]", toneClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-sm leading-6 opacity-90">{toast.description}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full border border-current/15 px-2 py-1 text-xs font-semibold opacity-80 transition hover:opacity-100"
          aria-label="Cerrar notificación"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback((toast: ToastInput) => {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setToasts((currentToasts) => [
      ...currentToasts,
      {
        ...toast,
        durationMs: toast.durationMs ?? 7000,
        variant: toast.variant ?? "error",
        id: toastId,
      },
    ]);

    return toastId;
  }, []);

  const contextValue = useMemo(
    () => ({ pushToast, dismissToast }),
    [dismissToast, pushToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastCard toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}