// When the frontend and backend are hosted separately (e.g. frontend on Vercel,
// backend on Render), set VITE_API_BASE_URL in the frontend's environment to the
// backend's URL, e.g. https://cbookssheet.onrender.com
// When they're served together (npm start locally), leave it unset — '/api' just
// works since it's the same origin.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function api(path, opts = {}) {
  const res = await fetch(API_BASE + '/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.status === 204 ? null : res.json();
}