import { useState, useRef, useCallback } from 'react';
import ChallanModule from './ChallanModule';
import SchoolModule from './SchoolModule';
import OrderDetailModule from './OrderDetailModule';

const MODULES = [
  { key: 'challan', label: 'C.Book Challan Issue Details' },
  { key: 'school', label: 'School Master List' },
  { key: 'orders', label: '3-Year Specimen & Order Detail' },
];

export default function App() {
  const [activeModule, setActiveModule] = useState('challan');
  const [status, setStatusMsg] = useState('');
  const [statusError, setStatusError] = useState(false);
  const statusTimer = useRef(null);

  const setStatus = useCallback((msg, isError = false) => {
    setStatusMsg(msg);
    setStatusError(isError);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMsg(''), 3000);
  }, []);

  return (
    <>
      <header className="topbar">
        <h1>चिल्ड्रन बुक स्पेसिमेन प्रबंधन प्रणाली</h1>
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
      {activeModule === 'orders' && <OrderDetailModule setStatus={setStatus} />}

      <div className={`global-status ${statusError ? 'error' : ''}`}>{status}</div>
    </>
  );
}