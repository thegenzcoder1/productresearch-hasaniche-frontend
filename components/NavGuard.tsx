'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type Blocker = { dirty: boolean; save: () => Promise<boolean> };
type Ctx = { register: (b: Blocker | null) => void; attempt: (navFn: () => void) => void };

const NavGuardCtx = createContext<Ctx>({ register: () => {}, attempt: (fn) => fn() });
export const useNavGuard = () => useContext(NavGuardCtx);

/** Pages call this with their dirty flag + a save() that resolves true on success. */
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>) {
  const { register } = useNavGuard();
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    register({ dirty, save: () => saveRef.current() });
    return () => register(null);
  }, [dirty, register]);
}

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const blockerRef = useRef<Blocker | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);

  const register = useCallback((b: Blocker | null) => { blockerRef.current = b; }, []);
  const attempt = useCallback((navFn: () => void) => {
    if (blockerRef.current?.dirty) setPending(() => navFn);
    else navFn();
  }, []);

  const onSave = async () => {
    if (!blockerRef.current) { setPending(null); return; }
    setBusy(true);
    try {
      const ok = await blockerRef.current.save();
      const fn = pending;
      setPending(null);
      if (ok && fn) fn();          // only navigate if the save actually succeeded
    } finally { setBusy(false); }
  };
  const onExit = () => { const fn = pending; setPending(null); fn && fn(); };
  const onCancel = () => setPending(null);

  return (
    <NavGuardCtx.Provider value={{ register, attempt }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <div>
              <p className="text-lg font-bold text-ink">Unsaved changes</p>
              <p className="text-sm text-gray-500 mt-1">You have changes that haven’t been saved yet. What would you like to do?</p>
            </div>
            <div className="flex flex-col gap-2">
              <button className="btn btn-primary justify-center py-2.5" onClick={onSave} disabled={busy}>
                {busy ? 'Saving…' : '💾 Save'}
              </button>
              <button className="btn btn-danger justify-center py-2.5" onClick={onExit} disabled={busy}>Exit Without Saving</button>
              <button className="btn btn-ghost justify-center" onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </NavGuardCtx.Provider>
  );
}
