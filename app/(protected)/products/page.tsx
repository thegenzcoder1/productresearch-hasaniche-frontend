'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, imgUrl } from '@/lib/api';
import { PendingBadge, fmtMoney, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';

type Product = {
  id: number; name: string; image_path?: string | null;
  pending_ads: number; tags: string[];
  sourcing_cost?: number | null; mrp?: number | null;
};

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setProducts(await api('/api/products')); }
    catch (e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(s) || (p.tags || []).some((t) => t.toLowerCase().includes(s)));
  }, [q, products]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return;
    if (products.some((p) => p.name.trim().toLowerCase() === nm.toLowerCase())) {
      toast('A product with this name already exists', 'err'); return;
    }
    try {
      const { id } = await api('/api/products', { method: 'POST', body: JSON.stringify({ name: nm }) });
      setName(''); setCreating(false);
      window.location.href = `/products/${id}`;
    } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">Products</h1>
          <p className="text-sm font-medium text-muted mt-1">{products.length} in research</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}>+ New product</button>
      </div>

      {creating && (
        <form onSubmit={create} className="card p-3 flex gap-2">
          <input className="input" placeholder="Product name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary shrink-0">Create</button>
          <button type="button" className="btn btn-ghost shrink-0" onClick={() => setCreating(false)}>Cancel</button>
        </form>
      )}

      <input className="input max-w-sm" placeholder="🔍 Search by name or tag…" value={q} onChange={(e) => setQ(e.target.value)} />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState>{products.length === 0 ? 'No products yet — create your first one.' : 'No matches.'}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const margin = p.mrp != null && p.sourcing_cost != null ? Number(p.mrp) - Number(p.sourcing_cost) : null;
            return (
              <Link key={p.id} href={`/products/${p.id}`} className="card card-hover p-4 block">
                <div className="aspect-[9/16] max-h-72 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/60 mb-3 overflow-hidden flex items-center justify-center">
                  {p.image_path
                    ? <img src={imgUrl(p.image_path)!} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="text-slate-300 text-2xl">🖼️</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-ink truncate">{p.name}</h3>
                  <PendingBadge count={p.pending_ads} />
                </div>
                {(p.mrp != null || margin != null) && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    {p.mrp != null && <span className="font-extrabold text-ink">{fmtMoney(p.mrp)}</span>}
                    {margin != null && (
                      <span className={`font-bold ${margin >= 0 ? 'text-done' : 'text-danger'}`}>
                        {margin >= 0 ? '+' : ''}{fmtMoney(margin)} margin
                      </span>
                    )}
                  </div>
                )}
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {p.tags.slice(0, 5).map((t, i) => (
                      <span key={i} className="text-xs font-semibold bg-indigo-50 text-accent-dark rounded-md px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
