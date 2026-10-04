import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
}

type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);

  const show = useCallback<ShowToast>((message, action) => {
    setToast({ id: Date.now(), message, action });
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), action ? 6000 : 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-[2000] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3.5 rounded-[10px] bg-slate-900 px-4 py-2.5 text-[13px] text-white shadow-pop transition-[opacity,transform] duration-200 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <span>{toast?.message}</span>
        {toast?.action && visible && (
          <button
            type="button"
            className="pointer-events-auto shrink-0 border-0 bg-transparent py-0.5 text-[13px] font-semibold text-teal-300 underline underline-offset-2 hover:text-white"
            onClick={() => {
              const run = toast.action?.run;
              setVisible(false);
              run?.();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast außerhalb von ToastProvider");
  return v;
}
