'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { token } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem('token', token);
      router.push('/products');
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="card p-8 w-full max-w-sm space-y-6 shadow-lift">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white font-black text-2xl shadow-glow
                          bg-[linear-gradient(135deg,#6366f1,#8b5cf6)]">P</div>
          <div>
            <h1 className="text-xl font-extrabold text-ink">Product Research</h1>
            <p className="text-sm font-medium text-muted">Sign in to your workspace</p>
          </div>
        </div>
        {err && <div className="text-sm font-medium text-danger bg-danger/10 rounded-xl px-3 py-2.5 text-center">{err}</div>}
        <div className="space-y-3">
          <input className="input" placeholder="Username" value={username}
            onChange={(e) => setUsername(e.target.value)} autoFocus />
          <input className="input" type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary w-full justify-center py-3 text-base" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>
      </form>
    </div>
  );
}
