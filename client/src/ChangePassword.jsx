import { useRef, useEffect, useState } from 'react';
import { api, setToken } from './api';

// `forced` = first login with a temporary password: cannot be closed until changed.
export default function ChangePassword({ open, forced, onClose, onChanged }) {
  const dialogRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    const f = e.target;
    setError('');
    if (f.new_password.value !== f.confirm.value) { setError('New password and confirm password do not match'); return; }
    setBusy(true);
    try {
      const data = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: f.current.value, new_password: f.new_password.value }),
      });
      setToken(data.token);
      f.reset();
      onChanged(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} onCancel={(e) => { if (forced) e.preventDefault(); else onClose(); }}>
      <form onSubmit={submit}>
        <h2>{forced ? 'Set a new password' : 'Change Password'}</h2>
        {forced && <p style={{ fontSize: 12, marginTop: 0 }}>You are using a temporary password. Please set your own password to continue.</p>}
        <label>
          Current password
          <input name="current" type="password" required autoComplete="current-password" />
        </label>
        <label>
          New password (min 8 characters)
          <input name="new_password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label>
          Confirm new password
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error && <div className="login-error">{error}</div>}
        <div className="dialog-actions">
          {!forced && <button type="button" className="secondary" onClick={onClose}>Cancel</button>}
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Password'}</button>
        </div>
      </form>
    </dialog>
  );
}