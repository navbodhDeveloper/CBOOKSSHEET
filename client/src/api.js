// When the frontend and backend are hosted separately (e.g. frontend on Vercel,
// backend on AWS), set VITE_API_BASE_URL in the frontend's environment to the
// backend's URL, e.g. https://13-207-96-18.sslip.io
// When they're served together (npm start locally), leave it unset — '/api' just
// works since it's the same origin.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ---- login token (kept in this browser only) ----
const TOKEN_KEY = 'cbook_token';
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

function handleUnauthorized(path) {
  // A wrong password on the login form is also a 401 — don't treat that as "session expired".
  if (path === '/auth/login') return;
  clearToken();
  window.dispatchEvent(new Event('cbook-auth-expired'));
}

export async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch(API_BASE + '/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) handleUnauthorized(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.status === 204 ? null : res.json();
}

// Downloads a file (Excel export) with the login token. A plain link / window.location
// can't send the token, so we fetch the file and save it ourselves.
export async function downloadFile(path) {
  const token = getToken();
  const res = await fetch(API_BASE + '/api' + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) handleUnauthorized(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || 'Download failed');
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const filename = m ? decodeURIComponent(m[1]) : 'download.xlsx';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}