'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, imgUrl } from '@/lib/api';
import { StatTile, Field, fmtNum, fmtMoney, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useUnsavedChanges } from '@/components/NavGuard';

type PLink = { url: string; label: string | null; price: number | null };
type Item = {
  id: number;
  name: string;
  image_path: string | null;
  pain_point: string;
  sourcing_cost: string;
  mrp: string;
  amazon_sold_last_month: string;
  amazon_avg_price: string;
  ad_angles: string[];
  // read-only signals (from backend, not editable here)
  total_impressions: number;
  amazon_rating: number | null;
  product_links: PLink[];
};

const toItem = (p: any): Item => ({
  id: p.id,
  name: p.name,
  image_path: p.image_path ?? null,
  pain_point: p.pain_point ?? '',
  sourcing_cost: p.sourcing_cost == null ? '' : String(p.sourcing_cost),
  mrp: p.mrp == null ? '' : String(p.mrp),
  amazon_sold_last_month: p.amazon_sold_last_month == null ? '' : String(p.amazon_sold_last_month),
  amazon_avg_price: p.amazon_avg_price == null ? '' : String(p.amazon_avg_price),
  ad_angles: p.ad_angles || [],
  total_impressions: Number(p.total_impressions || 0),
  amazon_rating: p.amazon_rating == null ? null : Number(p.amazon_rating),
  product_links: (p.product_links || []).map((l: any) => ({ url: l.url, label: l.label ?? null, price: l.price == null ? null : Number(l.price) })),
});

export default function RankingPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const snapshot = useRef<string>('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = async () => {
    setLoadErr(null);
    const rows = await api('/api/products');
    const its = rows.map(toItem);
    setItems(its);
    snapshot.current = JSON.stringify(its);
  };
  useEffect(() => { load().catch((e) => setLoadErr(e.message)); }, []); // eslint-disable-line

  const dirty = useMemo(() => (items ? JSON.stringify(items) !== snapshot.current : false), [items]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ---- local mutators (no backend) ----
  const setField = (id: number, key: keyof Item, val: any) =>
    setItems((prev) => (prev || []).map((it) => (it.id === id ? { ...it, [key]: val } : it)));

  const move = (id: number, dir: 'up' | 'down') =>
    setItems((prev) => {
      const arr = [...(prev || [])];
      const i = arr.findIndex((p) => p.id === id);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });

  const onDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) { setDragId(null); return; }
    setItems((prev) => {
      const arr = [...(prev || [])];
      const from = arr.findIndex((p) => p.id === dragId);
      const to = arr.findIndex((p) => p.id === targetId);
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
    setDragId(null);
  };

  // ---- Save: the ONLY backend write ----
  const save = async (): Promise<boolean> => {
    if (!items) return false;
    setSaving(true);
    try {
      const orig = JSON.parse(snapshot.current) as Item[];
      const origById: Record<number, Item> = Object.fromEntries(orig.map((o) => [o.id, o]));
      // 1. persist changed fields / ad-angles per product
      for (const it of items) {
        if (JSON.stringify(it) !== JSON.stringify(origById[it.id])) {
          await api(`/api/products/${it.id}/full`, {
            method: 'PUT',
            body: JSON.stringify({
              pain_point: it.pain_point.trim() || null,
              sourcing_cost: it.sourcing_cost === '' ? null : Number(it.sourcing_cost),
              mrp: it.mrp === '' ? null : Number(it.mrp),
              amazon_sold_last_month: it.amazon_sold_last_month === '' ? null : Number(it.amazon_sold_last_month),
              amazon_avg_price: it.amazon_avg_price === '' ? null : Number(it.amazon_avg_price),
              ad_angles: it.ad_angles,
            }),
          });
        }
      }
      // 2. persist new order if it changed
      const newOrder = items.map((i) => i.id).join(',');
      if (newOrder !== orig.map((i) => i.id).join(',')) {
        await api('/api/ranking/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds: items.map((i) => i.id) }) });
      }
      toast('Ranking saved ✓');
      await load();
      return true;
    } catch (e: any) { toast(e.message, 'err'); return false; }
    finally { setSaving(false); }
  };

  useUnsavedChanges(dirty, save);

  if (loadErr) return (
    <div className="max-w-md mx-auto mt-10 card p-6 text-center space-y-3">
      <p className="text-2xl">📡</p>
      <p className="text-ink font-semibold">Couldn’t load ranking</p>
      <p className="text-sm text-gray-500">{loadErr}</p>
      <button className="btn btn-primary mx-auto" onClick={() => load().catch((e) => setLoadErr(e.message))}>Retry</button>
    </div>
  );
  if (!items) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-5 max-w-3xl pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">Ranking</h1>
          <p className="text-sm font-medium text-muted mt-1">Reorder with ▲▼ or drag, and edit fields. Nothing saves until you tap Save.</p>
        </div>
        {dirty && <span className="shrink-0 text-xs font-semibold text-pending bg-pending/10 px-2.5 py-1 rounded-full">● Unsaved</span>}
      </div>

      {items.length === 0 ? (
        <EmptyState>No products to rank yet.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {items.map((p, i) => {
            const sc = p.sourcing_cost === '' ? null : Number(p.sourcing_cost);
            const mrp = p.mrp === '' ? null : Number(p.mrp);
            const margin = sc != null && mrp != null ? mrp - sc : null;
            const marginPct = margin != null && mrp ? Math.round((margin / mrp) * 100) : null;
            const open = expanded === p.id;
            return (
              <div key={p.id} className={`card overflow-hidden transition ${dragId === p.id ? 'opacity-50' : ''}`}
                draggable onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(p.id)}>
                <div className="flex items-center gap-3 p-3">
                  <span className="cursor-grab text-gray-300 select-none hidden sm:block" title="Drag to reorder">⠿</span>
                  <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent/10 text-accent font-bold text-sm shrink-0">{i + 1}</span>
                  <div className="w-10 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {p.image_path
                      ? <img src={imgUrl(p.image_path)!} alt="" className="w-full h-full object-cover" />
                      : <span className="text-gray-300 text-xs">—</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">{p.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                      <span>MRP {fmtMoney(mrp)}</span>
                      {margin != null && (
                        <span className={margin >= 0 ? 'text-done font-medium' : 'text-danger font-medium'}>
                          {margin >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(margin))}{marginPct != null ? ` (${marginPct}%)` : ''}
                        </span>
                      )}
                      <span title="Ad angles">🎯 {p.ad_angles.length}</span>
                      <span title="Amazon sold / month">🛒 {fmtNum(p.amazon_sold_last_month === '' ? null : Number(p.amazon_sold_last_month))}</span>
                      <span title="Impressions (summed from ad links)">👁 {fmtNum(p.total_impressions)}</span>
                      {p.amazon_avg_price !== '' && <span title="Average Amazon price">🅰 {fmtMoney(Number(p.amazon_avg_price))}</span>}
                      {p.amazon_rating != null && <span title="Amazon rating" className="text-amber-500">⭐ {p.amazon_rating.toFixed(1)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col shrink-0">
                    <button className="text-gray-400 hover:text-ink disabled:opacity-25 leading-none px-1" disabled={i === 0} onClick={() => move(p.id, 'up')}>▲</button>
                    <button className="text-gray-400 hover:text-ink disabled:opacity-25 leading-none px-1" disabled={i === items.length - 1} onClick={() => move(p.id, 'down')}>▼</button>
                  </div>
                  <button className={`btn btn-sm shrink-0 ${open ? 'btn-danger' : 'btn-primary'}`} onClick={() => setExpanded(open ? null : p.id)}>
                    {open ? '✕ Close' : 'Edit'}
                  </button>
                </div>

                {open && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatTile label="Sourcing" value={fmtMoney(sc)} />
                      <StatTile label="MRP" value={fmtMoney(mrp)} tone="accent" />
                      <StatTile label="Margin" value={margin == null ? '—' : fmtMoney(margin)} sub={marginPct == null ? undefined : `${marginPct}%`} tone={margin == null ? 'default' : margin >= 0 ? 'good' : 'bad'} />
                      <StatTile label="Amazon / mo" value={fmtNum(p.amazon_sold_last_month === '' ? null : Number(p.amazon_sold_last_month))} />
                      <StatTile label="Impressions" value={fmtNum(p.total_impressions)} sub="from ad links" />
                      <StatTile label="Avg Amazon price" value={p.amazon_avg_price === '' ? '—' : fmtMoney(Number(p.amazon_avg_price))} />
                    </div>

                    <Field label="Pain point / problem solved">
                      <textarea className="input min-h-[84px] resize-y" placeholder="What problem does this solve?"
                        value={p.pain_point} onChange={(e) => setField(p.id, 'pain_point', e.target.value)} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Sourcing cost">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input className="input pl-8" type="number" inputMode="decimal" placeholder="0"
                            value={p.sourcing_cost} onChange={(e) => setField(p.id, 'sourcing_cost', e.target.value)} />
                        </div>
                      </Field>
                      <Field label="MRP">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input className="input pl-8" type="number" inputMode="decimal" placeholder="0"
                            value={p.mrp} onChange={(e) => setField(p.id, 'mrp', e.target.value)} />
                        </div>
                      </Field>
                      <Field label="Amazon sold (last month)">
                        <input className="input" type="number" placeholder="e.g. 12000"
                          value={p.amazon_sold_last_month} onChange={(e) => setField(p.id, 'amazon_sold_last_month', e.target.value)} />
                      </Field>
                      <Field label="Average Amazon price">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                          <input className="input pl-8" type="number" inputMode="decimal" placeholder="0"
                            value={p.amazon_avg_price} onChange={(e) => setField(p.id, 'amazon_avg_price', e.target.value)} />
                        </div>
                      </Field>
                    </div>
                    <p className="text-xs text-gray-400">
                      👁 Impressions ({fmtNum(p.total_impressions)}) are summed automatically from this product’s ad-link impressions — edit them on the product page.
                    </p>

                    {/* Product page links & prices (read-only here — edit on the product page) */}
                    <div>
                      <label className="section-title block mb-1.5">Product page links & prices <span className="normal-case font-normal text-gray-400">— for price assumption</span></label>
                      {p.product_links.length === 0 ? (
                        <EmptyState>No product/competitor links yet — add them on the product page.</EmptyState>
                      ) : (
                        <div className="space-y-2">
                          {p.product_links.map((l, idx) => (
                            <div key={idx} className="item-box">
                              <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline truncate flex-1 min-w-0">{l.label || l.url}</a>
                              {l.price != null && <span className="text-sm font-semibold text-ink shrink-0">{fmtMoney(l.price)}</span>}
                            </div>
                          ))}
                          {(() => {
                            const nums = p.product_links.map((l) => l.price).filter((n): n is number => n != null);
                            if (!nums.length) return null;
                            const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
                            return <p className="text-xs text-gray-500 pt-0.5">Avg competitor price: <span className="font-semibold text-ink">{fmtMoney(avg)}</span> · range {fmtMoney(Math.min(...nums))}–{fmtMoney(Math.max(...nums))}</p>;
                          })()}
                        </div>
                      )}
                    </div>

                    <AdAngles angles={p.ad_angles} onChange={(next) => setField(p.id, 'ad_angles', next)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Save bar */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-accent/30">
        <p className="text-sm text-gray-500">
          {dirty ? 'You have unsaved changes — reordering and edits are only sent when you save.' : 'All changes saved.'}
        </p>
        <button className="btn btn-primary px-6 py-2.5 w-full sm:w-auto justify-center" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : dirty ? '💾 Save ranking' : '✓ Saved'}
        </button>
      </div>
    </div>
  );
}

/* Ad angles — fully local; parent holds the array */
function AdAngles({ angles, onChange }: { angles: string[]; onChange: (next: string[]) => void }) {
  const [angle, setAngle] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!angle.trim()) return;
    onChange([...angles, angle.trim()]);
    setAngle('');
  };
  const del = (i: number) => onChange(angles.filter((_, idx) => idx !== i));
  return (
    <div>
      <label className="section-title block mb-1.5">Ad angles</label>
      <div className="space-y-2 mb-2">
        {angles.length === 0 && <EmptyState>No angles yet.</EmptyState>}
        {angles.map((a, i) => (
          <div key={i} className="item-box">
            <span className="text-accent">•</span>
            <span className="flex-1 text-sm text-ink min-w-0">{a}</span>
            <button type="button" onClick={() => del(i)} className="icon-x" aria-label="Delete">✕</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-white p-2 flex gap-2">
        <input className="input flex-1" placeholder="Add an angle…" value={angle} onChange={(e) => setAngle(e.target.value)} />
        <button className="btn btn-primary shrink-0">Add</button>
      </form>
    </div>
  );
}
