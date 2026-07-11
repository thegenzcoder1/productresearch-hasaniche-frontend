'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Toast = { id: number; msg: string; kind: 'ok' | 'err'; action?: { label: string; fn: () => void } };
type Ctx = { toast: (msg: string, kind?: 'ok' | 'err', action?: Toast['action']) => void };

const ToastCtx = createContext<Ctx>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback<Ctx['toast']>((msg, kind = 'ok', action) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind, action }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), action ? 6000 : 3000);
  }, []);

  // Global safety net: turn uncaught network errors into a toast instead of
  // the full-screen dev error overlay (common during nodemon backend restarts).
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message || e.reason || '');
      if (e.reason?.name === 'NetworkError' || /failed to fetch|reach the server/i.test(msg)) {
        e.preventDefault();
        toast(e.reason?.message || 'Network error — retrying may help', 'err');
      }
    };
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, [toast]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg text-sm text-white ${
              t.kind === 'ok' ? 'bg-done' : 'bg-danger'
            }`}
          >
            <span>{t.msg}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.fn();
                  setItems((s) => s.filter((x) => x.id !== t.id));
                }}
                className="underline font-semibold"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
