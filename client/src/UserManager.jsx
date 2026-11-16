import { useRef, useEffect, useState, useCallback } from 'react';
import { api } from './api';

// Admin only: create Data Entry users, reset their password, disable/enable, delete.
export default function UserManager({ open, onClose, setStatus }) {
  const dialogRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await api('/users')); } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) { dlg.showModal(); setError(''); load(); }
    if (!open && dlg.open) dlg.close();
  }, [open, load]);

  async function createUser(e) {
    e.preventDefault();
    const f = e.target;
    setError('');
    setBusy(true);
    try {
      await api('/users', { method: 'POST', body: JSON.stringify({ username: f.username.value, password: f.password.value }) });
      f.reset();
      setStatus('Data Entry user created');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(u, body, okMsg) {
    setError('');
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify(body) });
      setStatus(okMsg);
      load();
    } catch (err) { setError(err.message); }
  }

  function resetPassword(u) {
    const pw = window.prompt(`New password for "${u.username}" (min 8 characters):`);
    if (pw === null) return;
    update(u, { password: pw }, `Password reset for ${u.username}`);
  }

  async function remove(u) {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    setError('');
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      setStatus('User deleted');
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <dialog ref={dialogRef} onCancel={onClose} style={{ width: 560, maxWidth: '95vw' }}>
      <h2>Users</h2>
      <table className="user-table">
        <thead>
          <tr><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.role === 'admin' ? 'Admin' : 'Data Entry'}</td>
              <td>{u.active ? 'Active' : <span style={{ color: '#b00020' }}>Disabled</span>}</td>
              <td>
                {u.role === 'admin' ? <span style={{ color: '#777' }}>—</span> : (
                  <span className="user-actions">
                    <button type="button" className="secondary" onClick={() => resetPassword(u)}>Reset password</button>
                    <button type="button" className="secondary" onClick={() => update(u, { active: !u.active }, u.active ? 'User disabled' : 'User enabled')}>
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="secondary" style={{ color: '#b00020' }} onClick={() => remove(u)}>Delete</button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={createUser} className="user-add">
        <h3>Add Data Entry user</h3>
        <label>
          Username (letters / numbers, min 3)
          <input name="username" required minLength={3} autoComplete="off" />
        </label>
        <label>
          Password (min 8 characters)
          <input name="password" type="text" required minLength={8} autoComplete="off" />
        </label>
        {error && <div className="login-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Close</button>
          <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </div>
      </form>
    </dialog>
  );
}