'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, imgUrl } from '@/lib/api';
import { EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useNavGuard } from '@/components/NavGuard';

type Pending = { id: number; name: string; image_path: string | null; missing: string[] };

export default function PendingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { attempt } = useNavGuard();
  const [items, setItems] = useState<Pending[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = async () => {
    setLoadErr(null);
    setItems(await api('/api/products/pending'));
  };
  useEffect(() => { load().catch((e) => setLoadErr(e.message)); }, []); // eslint-disable-line

  const markComplete = async (id: number) => {
    try {
      await api(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify({ details_complete: 1 }) });
      toast('Marked as all details entered');
      load();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  if (loadErr) return (
    <div className="max-w-md mx-auto mt-10 card p-6 text-center space-y-3">
      <p className="text-2xl">📡</p>
      <p className="text-ink font-semibold">Couldn’t load pending products</p>
      <p className="text-sm text-gray-500">{loadErr}</p>
      <button className="btn btn-primary mx-auto" onClick={() => load().catch((e) => setLoadErr(e.message))}>Retry</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-ink tracking-tight">Pending products</h1>
        <p className="text-sm font-medium text-muted mt-1">
          Products still missing details. Open one to fill it in, or mark it “all details entered” to clear it from this list.
        </p>
      </div>

      {!items ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState>🎉 Nothing pending — every product has its details filled in (or was marked complete).</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <div key={p.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-[76px] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/60 overflow-hidden shrink-0 grid place-items-center">
                  {p.image_path
                    ? <img src={imgUrl(p.image_path)!} alt="" className="w-full h-full object-cover" />
                    : <span className="text-slate-300 text-xl">🖼️</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-ink truncate">{p.name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {p.missing.map((m) => (
                      <span key={m} className="text-[11px] font-semibold bg-pending/10 text-pending rounded-full px-2 py-0.5">Missing: {m}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn btn-primary btn-sm" onClick={() => attempt(() => router.push(`/products/${p.id}`))}>Update →</button>
                <button className="btn btn-soft btn-sm" onClick={() => markComplete(p.id)}>All details entered</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
