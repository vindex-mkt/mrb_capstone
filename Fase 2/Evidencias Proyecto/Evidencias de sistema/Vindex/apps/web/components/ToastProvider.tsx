"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastEntry = { id: number; message: string; kind: ToastKind };
type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
  showCenteredSuccess: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de ToastProvider.");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [centeredSuccess, setCenteredSuccess] = useState<string | null>(null);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const centeredSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    if (centeredSuccessTimer.current) clearTimeout(centeredSuccessTimer.current);
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
  const dismissCenteredSuccess = useCallback(() => {
    if (centeredSuccessTimer.current) clearTimeout(centeredSuccessTimer.current);
    centeredSuccessTimer.current = null;
    setCenteredSuccess(null);
  }, []);
  const showCenteredSuccess = useCallback((message: string) => {
    if (centeredSuccessTimer.current) clearTimeout(centeredSuccessTimer.current);
    setCenteredSuccess(message);
    centeredSuccessTimer.current = setTimeout(() => {
      centeredSuccessTimer.current = null;
      setCenteredSuccess(null);
    }, 3_000);
  }, []);
  const contextValue = useMemo(
    () => ({ showToast, showCenteredSuccess }),
    [showToast, showCenteredSuccess],
  );

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
      {centeredSuccess && (
        <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center bg-foreground/30 p-4" aria-live="polite">
          <div
            role="status"
            aria-atomic="true"
            className="pointer-events-auto relative w-full max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border border-emerald-200 bg-surface px-6 py-7 text-center shadow-pop duration-300 motion-reduce:animate-none"
          >
            <button type="button" onClick={dismissCenteredSuccess} aria-label="Cerrar notificación" className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
            <div className="mx-auto mb-4 flex size-16 animate-in zoom-in-50 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 duration-300 motion-reduce:animate-none">
              <Check className="size-8" aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold text-foreground">¡Listo!</p>
            <p className="mt-2 text-sm text-muted-foreground">{centeredSuccess}</p>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}