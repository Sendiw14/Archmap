"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
type Notify = (message: string, kind?: ToastKind) => void;

const Ctx = createContext<Notify>(() => {});
export const useToast = () => useContext(Ctx);

/** Notifications: announced politely to screen readers, dismissible, auto-removed. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback<Notify>(
    (message, kind = "success") => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-2), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => notify, [notify]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-3 z-[70] flex flex-col items-center gap-2 px-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="am-pop pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border border-line bg-ink px-3.5 py-2.5 text-[14px] text-white shadow-lg"
          >
            {t.kind === "error" ? (
              <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 flex-none" />
            ) : (
              <Check size={18} aria-hidden="true" className="mt-0.5 flex-none" />
            )}
            <span className="min-w-0 break-words">{t.message}</span>
            <button
              type="button"
              className="-my-1 -mr-1.5 inline-flex size-8 flex-none items-center justify-center rounded-md hover:bg-white/15"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
