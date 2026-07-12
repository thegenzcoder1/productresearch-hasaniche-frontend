'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toast';

/* ---------------- formatting ---------------- */
export function fmtNum(n?: number | null) {
  if (n == null || (n as any) === '') return '—';
  const v = Number(n);
  if (isNaN(v)) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

export function fmtMoney(n?: number | null) {
  if (n == null || (n as any) === '') return '—';
  const v = Number(n);
  if (isNaN(v)) return '—';
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/* ---------------- badges ---------------- */
export function PendingBadge({ count }: { count: number }) {
  const zero = count === 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ring-1 ${
        zero ? 'bg-done/10 text-done ring-done/20' : 'bg-pending/10 text-pending ring-pending/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${zero ? 'bg-done' : 'bg-pending animate-pulse'}`} />
      {zero ? 'All ads done' : `${count} ad${count === 1 ? '' : 's'} pending`}
    </span>
  );
}

/* ---------------- stat tile ---------------- */
export function StatTile({ label, value, tone = 'default', sub }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  tone?: 'default' | 'accent' | 'good' | 'bad';
}) {
  const tones = {
    default: 'from-slate-50 to-slate-100/60 border-slate-200 text-ink',
    accent: 'from-indigo-50 to-violet-50 border-indigo-200/70 text-accent-dark',
    good: 'from-emerald-50 to-teal-50 border-emerald-200/70 text-done',
    bad: 'from-rose-50 to-red-50 border-rose-200/70 text-danger',
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 bg-gradient-to-br ${tones}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-xl font-extrabold leading-tight mt-1">{value}</p>
      {sub != null && <p className="text-[11px] font-medium opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ---------------- section card ---------------- */
export function SectionCard({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="flex items-center gap-2.5">
          {icon && <span className="w-8 h-8 rounded-xl grid place-items-center text-base bg-slate-100 shrink-0">{icon}</span>}
          <span className="text-[15px] font-bold text-ink">{title}</span>
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-box">{children}</div>;
}

/* ---------------- auto-save field (looks like a box, saves on blur/Enter) ---------------- */
export function AutoField({ value, onSave, type = 'text', multiline, placeholder, prefix, big }: {
  value: string | number | null | undefined;
  onSave: (v: string) => Promise<void> | void;
  type?: 'text' | 'number';
  multiline?: boolean;
  placeholder?: string;
  prefix?: string;
  big?: boolean;
}) {
  const { toast } = useToast();
  const norm = (v: any) => (v == null ? '' : String(v));
  const [val, setVal] = useState(norm(value));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const base = useRef(norm(value));

  useEffect(() => { base.current = norm(value); setVal(norm(value)); }, [value]);

  const commit = async () => {
    if (val === base.current || saving) return;
    setSaving(true);
    try {
      await onSave(val);
      base.current = val;
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    } catch (e: any) {
      toast(e.message || 'Save failed', 'err');   // never let it become an uncaught rejection
    } finally { setSaving(false); }
  };

  const common = {
    value: val,
    placeholder,
    onChange: (e: any) => setVal(e.target.value),
    onBlur: commit,
    className: `input ${prefix ? 'pl-8' : ''} ${big ? 'text-lg font-bold !py-2' : ''}`,
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      {multiline ? (
        <textarea {...common} rows={3} className={`${common.className} min-h-[84px] resize-y`} />
      ) : (
        <input
          {...common}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setVal(base.current); }}
        />
      )}
      {saved && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-done text-xs font-semibold flex items-center gap-1">
          ✓ Saved
        </span>
      )}
    </div>
  );
}

/* ---------------- labeled field wrapper ---------------- */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="section-title block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* ---------------- confirm (two-step) ---------------- */
export function ConfirmButton({ label, confirmLabel, onConfirm, className }: {
  label: string; confirmLabel?: string; onConfirm: () => void; className?: string;
}) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="inline-flex gap-2 items-center">
      <button className={className || 'btn btn-danger'} onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
      <button className="btn btn-ghost" onClick={() => setArmed(false)}>Cancel</button>
    </span>
  ) : (
    <button className={className || 'btn btn-danger'} onClick={() => setArmed(true)}>{label}</button>
  );
}
