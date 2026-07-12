'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/Toast';
import { NavGuardProvider, useNavGuard } from '@/components/NavGuard';

const nav = [
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/ranking', label: 'Ranking', icon: '📊' },
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-gray-200 flex-col">
        <div className="px-5 py-5">
          <div className="font-bold text-ink leading-tight">Product<br />Research</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <button key={n.href} onClick={() => go(n.href)}
                className={`w-full text-left block px-3 py-2 rounded-lg text-sm font-medium ${
                  active ? 'bg-accent/10 text-accent' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {n.label}
              </button>
            );
          })}
        </nav>
        <button onClick={logout} className="m-3 btn btn-ghost justify-start">Log out</button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 h-14">
        <span className="font-bold text-ink">Product Research</span>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-ink">Log out</button>
      </header>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-24 md:pb-8">{children}</div>
      </main>

      {/* Mobile bottom tab nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 flex pb-[env(safe-area-inset-bottom)]">
        {nav.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <button key={n.href} onClick={() => go(n.href)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                active ? 'text-accent' : 'text-gray-500'
              }`}>
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
