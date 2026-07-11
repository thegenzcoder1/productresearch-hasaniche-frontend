export const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5011';

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

export class NetworkError extends Error {
  constructor() { super(`Can't reach the server — is the backend running on ${BASE}?`); this.name = 'NetworkError'; }
}

export async function api(path: string, opts: RequestInit = {}) {
  const t = token();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...opts.headers,
      },
    });
  } catch {
    // fetch() only rejects on network-level failures (server down, CORS, offline)
    throw new NetworkError();
  }
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).error || 'Request failed';
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// multipart upload (no JSON content-type)
export async function upload(path: string, form: FormData) {
  const t = token();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: form,
    });
  } catch {
    throw new NetworkError();
  }
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).error || 'Upload failed';
    throw new Error(msg);
  }
  return res.json();
}

export function imgUrl(p?: string | null) {
  if (!p) return null;
  return p.startsWith('http') ? p : `${BASE}${p}`;
}
