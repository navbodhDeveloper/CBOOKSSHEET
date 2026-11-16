import { useState } from 'react';
import { api, setToken } from './api';

export default function Login({ onLoggedIn, notice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setToken(data.token);
      onLoggedIn(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>चिल्ड्रन बुक स्पेसिमेन प्रबंधन प्रणाली</h1>
        <p className="login-sub">Please log in to continue</p>
        {notice && <div className="login-notice">{notice}</div>}
        <label>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </div>
  );
}