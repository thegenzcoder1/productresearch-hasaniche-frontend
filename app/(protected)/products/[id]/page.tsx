'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, upload, imgUrl } from '@/lib/api';
import { StatTile, PendingBadge, SectionCard, EmptyState, ConfirmButton, Field, fmtMoney, fmtNum } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useNavGuard, useUnsavedChanges } from '@/components/NavGuard';

const DAYS_OLD_OPTIONS = ['This Week', 'One Week', 'Two Weeks', '3 Weeks', '> 1 Month', '> 2 Months'];
const AD_TYPE_OPTIONS = ['UGC', 'VSL', 'Hook', 'Testimonial', 'Unboxing', 'Demo', 'Founder Story', 'Problem/Solution', 'Listicle', 'Comparison', 'Meme', 'Static', 'Carousel', 'Explainer'];

type Supplier = { name: string; phone: string };
type AdLink = { url: string; label: string; impression: string; days_old: string; ad_type: string; status: 'pending' | 'done'; created_at?: string };
type ProductLink = { url: string; label: string; price: string };
type Comment = { body: string; created_at?: string };
type Draft = {
  name: string;
  description: string;
  sourcing_cost: string;
  mrp: string;
  amazon_rating: string;
  images: (string | null)[];   // 4 slots; [0] = main (required)
  suppliers: Supplier[];
  tags: string[];
  ad_links: AdLink[];
  product_links: ProductLink[];
  comments: Comment[];
};

const toDraft = (p: any): Draft => ({
  name: p.name ?? '',
  description: p.description ?? '',
  sourcing_cost: p.sourcing_cost == null ? '' : String(p.sourcing_cost),
  mrp: p.mrp == null ? '' : String(p.mrp),
  amazon_rating: p.amazon_rating == null ? '' : String(p.amazon_rating),
  images: [p.image_path ?? null, p.image_path_2 ?? null, p.image_path_3 ?? null, p.image_path_4 ?? null],
  suppliers: (p.suppliers || []).map((s: any) => ({ name: s.name || '', phone: s.phone || '' })),
  tags: (p.tags || []).map((t: any) => (typeof t === 'string' ? t : t.tag)),
  ad_links: (p.ad_links || []).map((l: any) => ({ url: l.url, label: l.label || '', impression: l.impression == null ? '' : String(l.impression), days_old: l.days_old || '', ad_type: l.ad_type || '', status: l.status, created_at: l.created_at })),
  product_links: (p.product_links || []).map((l: any) => ({ url: l.url, label: l.label || '', price: l.price == null ? '' : String(l.price) })),
  comments: (p.comments || []).map((c: any) => ({ body: c.body, created_at: c.created_at })),
});

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { attempt } = useNavGuard();
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  const [draft, setDraft] = useState<Draft | null>(null);
  const snapshot = useRef<string>('');           // JSON of last-saved draft (for dirty check)
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null, null]);

  const load = async () => {
    setLoadErr(null);
    const p = await api(`/api/products/${id}`);
    const d = toDraft(p);
    setDraft(d);
    snapshot.current = JSON.stringify(d);
    setImageFiles([null, null, null, null]); setImagePreviews([null, null, null, null]);
  };
  useEffect(() => { load().catch((e) => setLoadErr(e.message)); }, [id]); // eslint-disable-line

  const dirty = useMemo(
    () => (draft ? JSON.stringify(draft) !== snapshot.current : false) || imageFiles.some(Boolean),
    [draft, imageFiles]
  );

  // Warn before leaving (refresh/close) with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Guard in-app navigation (sidebar/tabs/back) — prompt Save / Exit when dirty
  useUnsavedChanges(dirty, () => saveRef.current());

  if (loadErr) return (
    <div className="max-w-md mx-auto mt-10 card p-6 text-center space-y-3">
      <p className="text-2xl">📡</p>
      <p className="text-ink font-semibold">Couldn’t load this product</p>
      <p className="text-sm text-gray-500">{loadErr}</p>
      <button className="btn btn-primary mx-auto" onClick={() => load().catch((e) => setLoadErr(e.message))}>Retry</button>
    </div>
  );
  if (!draft) return <p className="text-gray-400 text-sm">Loading…</p>;

  // ---- local mutators (NO backend calls) ----
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...(d as Draft), ...patch }));
  const pickImage = (slot: number, file: File) => {
    setImageFiles((a) => a.map((f, i) => (i === slot ? file : f)));
    setImagePreviews((a) => a.map((p, i) => (i === slot ? URL.createObjectURL(file) : p)));
  };
  const removeImage = (slot: number) => {
    setImageFiles((a) => a.map((f, i) => (i === slot ? null : f)));
    setImagePreviews((a) => a.map((p, i) => (i === slot ? null : p)));
    set({ images: (draft as Draft).images.map((p, i) => (i === slot ? null : p)) });
  };

  // ---- the ONLY function that talks to the backend for edits ----
  const save = async (): Promise<boolean> => {
    const nm = draft.name.trim();
    if (!nm) { toast('Name is required', 'err'); return false; }
    if (!draft.images[0] && !imageFiles[0]) { toast('A main product image is required', 'err'); return false; }
    setSaving(true);
    try {
      // Duplicate product-name guard (against other active products)
      const all = await api('/api/products');
      if (all.some((x: any) => x.id !== Number(id) && (x.name || '').trim().toLowerCase() === nm.toLowerCase())) {
        toast('A product with this name already exists', 'err');
        return false;
      }
      // Upload any newly-picked images, assemble the final 4-slot path array
      const finalPaths = [...draft.images];
      for (let i = 0; i < 4; i++) {
        if (imageFiles[i]) {
          const form = new FormData();
          form.append('image', imageFiles[i] as File);
          const { image_path } = await upload(`/api/products/${id}/image`, form);
          finalPaths[i] = image_path;
        }
      }
      await api(`/api/products/${id}/full`, {
        method: 'PUT',
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          sourcing_cost: draft.sourcing_cost === '' ? null : Number(draft.sourcing_cost),
          mrp: draft.mrp === '' ? null : Number(draft.mrp),
          amazon_rating: draft.amazon_rating === '' ? null : Number(draft.amazon_rating),
          image_path: finalPaths[0] || null,
          image_path_2: finalPaths[1] || null,
          image_path_3: finalPaths[2] || null,
          image_path_4: finalPaths[3] || null,
          suppliers: draft.suppliers,
          tags: draft.tags,
          ad_links: draft.ad_links.map((l) => ({ ...l, impression: l.impression === '' ? null : Number(l.impression), days_old: l.days_old || null, ad_type: l.ad_type || null })),
          product_links: draft.product_links.map((l) => ({ url: l.url, label: l.label || null, price: l.price === '' ? null : Number(l.price) })),
          comments: draft.comments,
        }),
      });
      toast('Product saved ✓');
      await load();                 // pull fresh, resets dirty + gets server timestamps
      return true;
    } catch (e: any) {
      toast(e.message, 'err');
      return false;
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = save;   // keep the nav-guard pointed at the latest save

  const archive = async () => {
    try {
      await api(`/api/products/${id}`, { method: 'DELETE' });
      toast('Archived', 'ok', {
        label: 'Undo',
        fn: async () => { try { await api(`/api/products/${id}/restore`, { method: 'POST' }); toast('Restored'); } catch (e: any) { toast(e.message, 'err'); } },
      });
      router.push('/products');
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const pending = draft.ad_links.filter((a) => a.status === 'pending').length;
  const sc = draft.sourcing_cost === '' ? null : Number(draft.sourcing_cost);
  const mrp = draft.mrp === '' ? null : Number(draft.mrp);
  const margin = sc != null && mrp != null ? mrp - sc : null;
  const marginPct = margin != null && mrp ? Math.round((margin / mrp) * 100) : null;
  const slotImg = (i: number) => imagePreviews[i] || imgUrl(draft.images[i]);

  return (
    <div className="space-y-4 max-w-3xl pb-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => attempt(() => router.push('/products'))} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">← Products</button>
        {dirty && <span className="text-xs font-semibold text-pending bg-pending/10 px-2.5 py-1 rounded-full">● Unsaved changes</span>}
      </div>

      {/* Header */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="space-y-2.5">
          <PendingBadge count={pending} />
          <input className="input text-lg font-bold" placeholder="Product name"
            value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <p className="section-title mb-2">Product images <span className="normal-case font-normal text-gray-400">— main required, up to 4</span></p>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[0, 1, 2, 3].map((i) => {
              const img = slotImg(i);
              return (
                <div key={i} className="relative aspect-square rounded-xl bg-gray-100 overflow-hidden group border border-gray-200">
                  <label className="w-full h-full flex items-center justify-center cursor-pointer">
                    {img
                      ? <img src={img} alt="" className="w-full h-full object-cover" />
                      : <span className="text-gray-400 text-[11px] text-center px-1 flex flex-col items-center gap-0.5"><span className="text-xl">🖼️</span>{i === 0 ? 'Main' : 'Add'}</span>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && pickImage(i, e.target.files[0])} />
                    {img && <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-medium transition">Replace</span>}
                  </label>
                  {i === 0 && <span className="absolute bottom-1 left-1 bg-accent text-white text-[9px] font-bold px-1.5 py-0.5 rounded">MAIN</span>}
                  {img && <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 grid place-items-center rounded-full bg-black/60 text-white text-xs hover:bg-danger" aria-label="Remove">✕</button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <SectionCard title="Pricing & margin" icon="💰">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Sourcing cost">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input className="input pl-8" type="number" inputMode="decimal" placeholder="0"
                value={draft.sourcing_cost} onChange={(e) => set({ sourcing_cost: e.target.value })} />
            </div>
          </Field>
          <Field label="MRP (our selling price)">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input className="input pl-8" type="number" inputMode="decimal" placeholder="0"
                value={draft.mrp} onChange={(e) => set({ mrp: e.target.value })} />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Sourcing" value={fmtMoney(sc)} />
          <StatTile label="MRP" value={fmtMoney(mrp)} tone="accent" />
          <StatTile label="Margin" value={margin == null ? '—' : fmtMoney(margin)}
            sub={marginPct == null ? undefined : `${marginPct}% of MRP`}
            tone={margin == null ? 'default' : margin >= 0 ? 'good' : 'bad'} />
        </div>
      </SectionCard>

      {/* Amazon rating */}
      <SectionCard title="Amazon rating" icon="⭐">
        <div className="flex items-center gap-4">
          <div className="w-28 shrink-0">
            <input className="input" type="number" min="0" max="5" step="0.1" placeholder="0.0"
              value={draft.amazon_rating} onChange={(e) => set({ amazon_rating: e.target.value })} />
          </div>
          <div className="text-sm">
            {draft.amazon_rating === ''
              ? <span className="text-gray-400">No rating yet (out of 5)</span>
              : <span className="text-ink font-semibold">{Number(draft.amazon_rating).toFixed(1)} <span className="text-amber-400">★</span> <span className="text-gray-400 font-normal">/ 5</span></span>}
          </div>
        </div>
      </SectionCard>

      {/* Description */}
      <SectionCard title="Description" icon="📝">
        <textarea className="input min-h-[84px] resize-y" placeholder="What is this product? Notes, research findings…"
          value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </SectionCard>

      {/* Ad / creative links */}
      <AdLinksSection draft={draft} set={set} />

      {/* Product page / competitor links */}
      <ProductLinksSection draft={draft} set={set} />

      {/* Suppliers */}
      <SuppliersSection draft={draft} set={set} />

      {/* Tags */}
      <TagsSection draft={draft} set={set} />

      {/* Comments */}
      <CommentsSection draft={draft} set={set} />

      {/* Save bar */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-accent/30">
        <p className="text-sm text-gray-500">
          {dirty ? 'You have unsaved changes — nothing is sent to the server until you save.' : 'All changes saved.'}
        </p>
        <button className="btn btn-primary px-6 py-2.5 w-full sm:w-auto justify-center" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : dirty ? '💾 Save product' : '✓ Saved'}
        </button>
      </div>

      {/* Danger zone */}
      <SectionCard title="Danger zone" icon="⚠️">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-500">Archiving moves this product to the Archive (restorable for 7 days).</p>
          <ConfirmButton label="Archive product" confirmLabel="Yes, archive" onConfirm={archive} />
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------------- Ad links (local) ---------------- */
function AdLinksSection({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [impression, setImpression] = useState('');
  const [daysOld, setDaysOld] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const toggleType = (t: string) => setTypes((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    if (!types.length) { toast('Select at least one ad type', 'err'); return; }
    if (draft.ad_links.some((l) => l.url.trim().toLowerCase() === u.toLowerCase())) {
      toast('This link already exists', 'err'); return;
    }
    set({ ad_links: [...draft.ad_links, { url: u, label: label.trim(), impression: impression.trim(), days_old: daysOld, ad_type: types.join(', '), status: 'pending' }] });
    setUrl(''); setLabel(''); setImpression(''); setDaysOld(''); setTypes([]);
  };
  const toggle = (i: number) => set({ ad_links: draft.ad_links.map((l, idx) => idx === i ? { ...l, status: l.status === 'pending' ? 'done' : 'pending' } : l) });
  const del = (i: number) => set({ ad_links: draft.ad_links.filter((_, idx) => idx !== i) });
  const pending = draft.ad_links.filter((l) => l.status === 'pending').length;
  const totalImp = draft.ad_links.reduce((s, l) => s + (l.impression === '' ? 0 : Number(l.impression) || 0), 0);
  return (
    <SectionCard title="Ad / creative links" icon="🎬"
      action={<span className="text-xs text-gray-400">{draft.ad_links.length} total · {pending} pending · 👁 {fmtNum(totalImp)}</span>}>
      <div className="space-y-2 mb-3">
        {draft.ad_links.length === 0 && <EmptyState>No links yet — add creatives to review.</EmptyState>}
        {draft.ad_links.map((l, i) => (
          <div key={i} className="item-box flex-wrap">
            <button type="button" onClick={() => toggle(i)}
              className={`btn btn-sm shrink-0 ${l.status === 'done' ? 'bg-done/10 text-done' : 'bg-pending/10 text-pending'}`}>
              {l.status === 'done' ? '✓ Done' : '● Pending'}
            </button>
            <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline truncate flex-1 min-w-0">{l.label || l.url}</a>
            {l.ad_type && <span className="text-[11px] shrink-0 whitespace-nowrap bg-accent/10 text-accent rounded-full px-2 py-0.5 font-medium" title="Ad type">{l.ad_type}</span>}
            {l.days_old && <span className="text-[11px] shrink-0 whitespace-nowrap bg-gray-100 text-gray-600 rounded-full px-2 py-0.5" title="Ad age">🗓 {l.days_old}</span>}
            {l.impression !== '' && <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap" title="Impressions">👁 {fmtNum(Number(l.impression))}</span>}
            <button type="button" onClick={() => del(i)} className="icon-x" aria-label="Delete">✕</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-gray-50/60 p-2 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <input className="input flex-1 min-w-[150px] bg-white" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="input w-24 bg-white" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="input w-24 bg-white" type="number" placeholder="Impressions" value={impression} onChange={(e) => setImpression(e.target.value)} />
          <select className="input w-32 bg-white" value={daysOld} onChange={(e) => setDaysOld(e.target.value)} title="Days old">
            <option value="">Days old…</option>
            {DAYS_OLD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-1">Ad type <span className="text-danger">*</span> (pick one or more)</p>
          <div className="flex flex-wrap gap-1.5">
            {AD_TYPE_OPTIONS.map((t) => {
              const on = types.includes(t);
              return (
                <button type="button" key={t} onClick={() => toggleType(t)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition ${on ? 'bg-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {on ? '✓ ' : ''}{t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary shrink-0">Add link</button>
        </div>
      </form>
    </SectionCard>
  );
}

/* ---------------- Product page / competitor links (local) ---------------- */
function ProductLinksSection({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    if (draft.product_links.some((l) => l.url.trim().toLowerCase() === u.toLowerCase())) {
      toast('This link already exists', 'err'); return;
    }
    set({ product_links: [...draft.product_links, { url: u, label: label.trim(), price: price.trim() }] });
    setUrl(''); setLabel(''); setPrice('');
  };
  const del = (i: number) => set({ product_links: draft.product_links.filter((_, idx) => idx !== i) });
  const nums = draft.product_links.map((l) => (l.price === '' ? NaN : Number(l.price))).filter((n) => !isNaN(n));
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  return (
    <SectionCard title="Product page links & prices" icon="🔗"
      action={avg != null ? <span className="text-xs text-gray-400">avg {fmtMoney(Math.round(avg))} · {nums.length} priced</span> : undefined}>
      <div className="space-y-2 mb-3">
        {draft.product_links.length === 0 && <EmptyState>No product/competitor links yet — add pages with their listed price.</EmptyState>}
        {draft.product_links.map((l, i) => (
          <div key={i} className="item-box">
            <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline truncate flex-1 min-w-0">{l.label || l.url}</a>
            {l.price !== '' && <span className="text-sm font-semibold text-ink shrink-0 whitespace-nowrap">{fmtMoney(Number(l.price))}</span>}
            <button type="button" onClick={() => del(i)} className="icon-x" aria-label="Delete">✕</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-gray-50/60 p-2 flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-[150px] bg-white" placeholder="https://… (Amazon, competitor, etc.)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="input w-24 bg-white" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
          <input className="input pl-7 bg-white" type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <button className="btn btn-primary shrink-0">Add link</button>
      </form>
    </SectionCard>
  );
}

/* ---------------- Suppliers (local) ---------------- */
function SuppliersSection({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (draft.suppliers.some((s) => s.name.trim().toLowerCase() === n.toLowerCase())) {
      toast('This supplier already exists', 'err'); return;
    }
    set({ suppliers: [...draft.suppliers, { name: n, phone: phone.trim() }] });
    setName(''); setPhone('');
  };
  const del = (i: number) => set({ suppliers: draft.suppliers.filter((_, idx) => idx !== i) });
  return (
    <SectionCard title="Suppliers" icon="🏭">
      <div className="space-y-2 mb-3">
        {draft.suppliers.length === 0 && <EmptyState>No suppliers yet.</EmptyState>}
        {draft.suppliers.map((s, i) => (
          <div key={i} className="item-box">
            <div className="grid place-items-center w-8 h-8 rounded-lg bg-accent/10 text-accent text-sm font-bold shrink-0">{(s.name || '?').charAt(0).toUpperCase()}</div>
            <span className="text-sm font-medium text-ink flex-1 min-w-0 truncate">{s.name}</span>
            {s.phone && <a href={`tel:${s.phone}`} className="text-sm text-accent hover:underline shrink-0">📞 {s.phone}</a>}
            <button type="button" onClick={() => del(i)} className="icon-x" aria-label="Delete">✕</button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-gray-50/60 p-2 flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-[140px] bg-white" placeholder="Supplier name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input w-36 bg-white" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn btn-primary shrink-0">Add</button>
      </form>
    </SectionCard>
  );
}

/* ---------------- Tags (local) ---------------- */
function TagsSection({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const { toast } = useToast();
  const [tag, setTag] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const list = tag.split(',').map((t) => t.trim()).filter(Boolean);
    if (!list.length) return;
    const existing = new Set(draft.tags.map((t) => t.toLowerCase()));
    const dupes: string[] = [];
    const fresh: string[] = [];
    for (const t of list) {
      const key = t.toLowerCase();
      if (existing.has(key) || fresh.some((f) => f.toLowerCase() === key)) dupes.push(t);
      else fresh.push(t);
    }
    if (dupes.length) toast(`Already exists: ${dupes.join(', ')}`, 'err');
    if (fresh.length) { set({ tags: [...draft.tags, ...fresh] }); setTag(''); }
  };
  const del = (i: number) => set({ tags: draft.tags.filter((_, idx) => idx !== i) });
  const pipi = draft.tags.length
    ? `https://www.pipiads.com/search?keyword=${encodeURIComponent(draft.tags.join(' '))}`
    : null;
  return (
    <SectionCard title="Tags" icon="🏷️"
      action={pipi && <a href={pipi} target="_blank" rel="noreferrer" className="btn btn-soft btn-sm">🔍 PiPi Ads ↗</a>}>
      <div className="flex flex-wrap gap-2 mb-3">
        {draft.tags.length === 0 && <EmptyState>No tags yet — used to hunt ads in spy tools.</EmptyState>}
        {draft.tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg pl-3 pr-1.5 py-1.5 text-sm font-medium shadow-sm">
            {t}
            <button type="button" onClick={() => del(i)} className="text-gray-300 hover:text-danger">✕</button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-gray-50/60 p-2 flex gap-2">
        <input className="input flex-1 bg-white" placeholder="Add tags (comma separated)…" value={tag} onChange={(e) => setTag(e.target.value)} />
        <button className="btn btn-primary shrink-0">Add</button>
      </form>
    </SectionCard>
  );
}

/* ---------------- Comments (local) ---------------- */
function CommentsSection({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const [body, setBody] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    set({ comments: [{ body: body.trim() }, ...draft.comments] });   // newest first
    setBody('');
  };
  const del = (i: number) => set({ comments: draft.comments.filter((_, idx) => idx !== i) });
  return (
    <SectionCard title="Comments" icon="💬">
      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-gray-50/60 p-2 flex gap-2 mb-3">
        <input className="input flex-1 bg-white" placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn btn-primary shrink-0">Post</button>
      </form>
      <div className="space-y-2">
        {draft.comments.length === 0 && <EmptyState>No comments yet.</EmptyState>}
        {draft.comments.map((c, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink whitespace-pre-wrap break-words">{c.body}</p>
              <p className="text-[11px] text-gray-400 mt-1">{c.created_at ? new Date(c.created_at + 'Z').toLocaleString() : 'just now (unsaved)'}</p>
            </div>
            <button type="button" onClick={() => del(i)} className="icon-x" aria-label="Delete">✕</button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
