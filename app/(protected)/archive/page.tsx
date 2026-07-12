'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, imgUrl } from '@/lib/api';
import { EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useUnsavedChanges } from '@/components/NavGuard';

type Action = null | 'restore' | 'delete';
type Arch = { id: number; name: string; image_path: string | null; days_left: number; action: Action };

export default function ArchivePage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Arch[] | null>(null);
  const snapshot = useRef<string>('');
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = async () => {
    setLoadErr(null);
    const rows = await api('/api/products/archived');
    const its: Arch[] = rows.map((r: any) => ({ id: r.id, name: r.name, image_path: r.image_path ?? null, days_left: r.days_left, action: null }));
    setItems(its);
    snapshot.current = JSON.stringify(its);
  };
  useEffect(() => { load().catch((e) => setLoadErr(e.message)); }, []); // eslint-disable-line

  const staged = useMemo(() => (items || []).filter((i) => i.action), [items]);
  const dirty = staged.length > 0;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const stage = (id: number, action: Action) =>
    setItems((prev) => (prev || []).map((i) => (i.id === id ? { ...i, action } : i)));

  // Save: the ONLY backend write
  const save = async (): Promise<boolean> => {
    if (!items) return false;
    setSaving(true);
    try {
      for (const it of items) {
        if (it.action === 'restore') await api(`/api/products/${it.id}/restore`, { method: 'POST' });
        else if (it.action === 'delete') await api(`/api/products/${it.id}/permanent`, { method: 'DELETE' });
      }
      const r = staged.filter((s) => s.action === 'restore').length;
      const d = staged.filter((s) => s.action === 'delete').length;
      toast(`Saved — ${r} restored, ${d} deleted`);
      await load();
      return true;
    } catch (e: any) { toast(e.message, 'err'); return false; }
    finally { setSaving(false); }
  };

  useUnsavedChanges(dirty, save);

  if (loadErr) return (
    <div className="max-w-md mx-auto mt-10 card p-6 text-center space-y-3">
      <p className="text-2xl">📡</p>
      <p className="text-ink font-semibold">Couldn’t load archive</p>
      <p className="text-sm text-gray-500">{loadErr}</p>
      <button className="btn btn-primary mx-auto" onClick={() => load().catch((e) => setLoadErr(e.message))}>Retry</button>
    </div>
  );

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">Archive</h1>
          <p className="text-sm font-medium text-muted mt-1">Stage restores/deletes here — they only take effect when you tap Save. Purged 7 days after deletion.</p>
        </div>
        {dirty && <span className="shrink-0 text-xs font-semibold text-pending bg-pending/10 px-2.5 py-1 rounded-full">● {staged.length} staged</span>}
      </div>

      {!items ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>Archive is empty.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <div key={p.id} className={`card p-4 transition ${p.action === 'delete' ? 'border-danger/40 bg-danger/5' : p.action === 'restore' ? 'border-done/40 bg-done/5' : ''}`}>
              <div className="aspect-video rounded-xl bg-gray-100 mb-3 overflow-hidden flex items-center justify-center">
                {p.image_path
                  ? <img src={imgUrl(p.image_path)!} alt={p.name} className="w-full h-full object-cover" />
                  : <span className="text-gray-300 text-sm">No image</span>}
              </div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-ink truncate">{p.name}</h3>
                <span className="text-xs font-semibold text-pending shrink-0">
                  {Math.max(0, p.days_left)} day{p.days_left === 1 ? '' : 's'} left
                </span>
              </div>

              {p.action ? (
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${p.action === 'delete' ? 'text-danger' : 'text-done'}`}>
                    {p.action === 'delete' ? '🗑️ Will delete' : '↩️ Will restore'}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => stage(p.id, null)}>Undo</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={() => stage(p.id, 'restore')}>Restore</button>
                  <button className="btn btn-danger btn-sm" onClick={() => stage(p.id, 'delete')}>Delete permanently</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-accent/30">
          <p className="text-sm text-gray-500">
            {dirty ? `${staged.length} change${staged.length === 1 ? '' : 's'} staged — nothing happens until you save.` : 'No changes staged.'}
          </p>
          <button className="btn btn-primary px-6 py-2.5 w-full sm:w-auto justify-center" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? '💾 Save changes' : '✓ Saved'}
          </button>
        </div>
      )}
    </div>
  );
}
