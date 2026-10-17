"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastEntry = { id: number; message: string; kind: ToastKind };
type ToastContextValue = { showToast: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de ToastProvider.");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, kind }]);
    timers.current.set(id, setTimeout(() => dismissToast(id), 4_000));
  }, [dismissToast]);
  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-pop ${
              toast.kind === "error"
                ? "border-red-200 text-red-800"
                : toast.kind === "success"
                  ? "border-emerald-200 text-emerald-800"
                  : "border-border text-foreground"
            }`}
          >
            {toast.kind === "success" ? <Check className="size-4 shrink-0" aria-hidden="true" /> : <Info className="size-4 shrink-0" aria-hidden="true" />}
            <p className="min-w-0 flex-1">{toast.message}</p>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Cerrar notificación" className="rounded p-1 hover:bg-muted">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}