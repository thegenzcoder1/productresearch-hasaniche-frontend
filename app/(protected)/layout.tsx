'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/Toast';
import { NavGuardProvider, useNavGuard } from '@/components/NavGuard';

const nav = [
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/ranking', label: 'Ranking', icon: '📊' },
  { href: '/pending', label: 'Pending', icon: '⏳' },
  { href: '/archive', label: 'Archive', icon: '🗄️' },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <ToastProvider>
      <NavGuardProvider>
        <Shell>{children}</Shell>
      </NavGuardProvider>
    </ToastProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { attempt } = useNavGuard();

  const go = (href: string) => attempt(() => router.push(href));
  const logout = () => attempt(() => { localStorage.removeItem('token'); router.replace('/login'); });

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar — rich dark gradient */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col text-slate-300
                        bg-[linear-gradient(180deg,#0f172a_0%,#1e1b4b_100%)] sticky top-0 h-screen">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center text-white font-black text-lg shadow-glow
                          bg-[linear-gradient(135deg,#6366f1,#8b5cf6)]">P</div>
          <div className="leading-tight">
            <div className="font-bold text-white">Product</div>
            <div className="text-xs text-indigo-300/80 -mt-0.5">Research</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <button key={n.href} onClick={() => go(n.href)}
                className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold transition ${
                  active
                    ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <span className="text-lg">{n.icon}</span>{n.label}
              </button>
            );
          })}
        </nav>
        <button onClick={logout}
          className="m-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition">
          <span>↩</span> Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14
                         text-white bg-[linear-gradient(135deg,#0f172a,#312e81)] shadow-lift">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg grid place-items-center text-white font-black text-sm
                          bg-[linear-gradient(135deg,#6366f1,#8b5cf6)]">P</div>
          <span className="font-bold">Product Research</span>
        </div>
        <button onClick={logout} className="text-sm font-medium text-indigo-200 hover:text-white">Log out</button>
      </header>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-9 pb-28 md:pb-9">{children}</div>
      </main>

      {/* Mobile bottom tab nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px_rgba(16,24,40,0.15)]">
        {nav.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <button key={n.href} onClick={() => go(n.href)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                active ? 'text-accent' : 'text-slate-400'
              }`}>
              <span className={`text-lg leading-none transition ${active ? 'scale-110' : ''}`}>{n.icon}</span>
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
