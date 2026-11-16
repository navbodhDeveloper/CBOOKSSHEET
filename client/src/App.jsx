import { useState, useRef, useCallback, useEffect } from 'react';
import ChallanModule from './ChallanModule';
import SchoolModule from './SchoolModule';
// import OrderDetailModule from './OrderDetailModule';
import PartyModule from './PartyModule';
import Login from './Login';
import ChangePassword from './ChangePassword';
import UserManager from './UserManager';
import { api, getToken, clearToken } from './api';
import './auth.css';

const MODULES = [
  { key: 'challan', label: 'C.Book Challan Issue Details' },
  { key: 'school', label: 'School Master List' },
  // { key: 'orders', label: '3-Year Specimen & Order Detail' },
  { key: 'parties', label: 'Parties' },
];

export default function App() {
  const [activeModule, setActiveModule] = useState('challan');
  const [status, setStatusMsg] = useState('');
  const [statusError, setStatusError] = useState(false);
  const statusTimer = useRef(null);

  // ---- login state ----
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [loginNotice, setLoginNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  const setStatus = useCallback((msg, isError = false) => {
    setStatusMsg(msg);
    setStatusError(isError);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMsg(''), 3000);
  }, []);

  // On page load: if a saved login exists, check it is still valid.
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(d => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  // Any request answered with "please log in" (expired / disabled / password changed) lands here.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setShowUsers(false);
      setLoginNotice('Your session ended. Please log in again.');
    };
    window.addEventListener('cbook-auth-expired', onExpired);
    return () => window.removeEventListener('cbook-auth-expired', onExpired);
  }, []);

  function logout() {
    clearToken();
    setUser(null);
    setShowUsers(false);
    setLoginNotice('');
  }

  if (checking) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!user) return <Login onLoggedIn={(u) => { setLoginNotice(''); setUser(u); }} notice={loginNotice} />;

  return (
    <>
      <header className="topbar">
        <h1>चिल्ड्रन बुक स्पेसिमेन प्रबंधन प्रणाली</h1>
        <div className="user-box">
          <span className="user-name">👤 {user.username} ({user.role === 'admin' ? 'Admin' : 'Data Entry'})</span>
          {user.role === 'admin' && <button type="button" onClick={() => setShowUsers(true)}>Users</button>}
          <button type="button" onClick={() => setShowPassword(true)}>Change Password</button>
          <button type="button" onClick={logout}>Logout</button>
        </div>
        <nav className="module-nav">
          {MODULES.map(m => (
            <button
              key={m.key}
              className={`module-nav-btn ${activeModule === m.key ? 'active' : ''}`}
              onClick={() => setActiveModule(m.key)}
            >
              {m.label}
            </button>
          ))}
        </nav>
      </header>

      {activeModule === 'challan' && <ChallanModule setStatus={setStatus} />}
      {activeModule === 'school' && <SchoolModule setStatus={setStatus} />}
      {/* {activeModule === 'orders' && <OrderDetailModule setStatus={setStatus} />} */}
      {activeModule === 'parties' && <PartyModule setStatus={setStatus} />}

      <div className={`global-status ${statusError ? 'error' : ''}`}>{status}</div>

      <ChangePassword
        open={showPassword || user.must_change}
        forced={user.must_change}
        onClose={() => setShowPassword(false)}
        onChanged={(u) => { setUser(u); setShowPassword(false); setStatus('Password changed'); }}
      />
      {user.role === 'admin' && <UserManager open={showUsers} onClose={() => setShowUsers(false)} setStatus={setStatus} />}
    </>
  );
}