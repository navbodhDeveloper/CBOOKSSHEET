import { useState, useEffect, useCallback, useRef } from 'react';
import { api, API_BASE } from './api';

// Column order for keyboard navigation: Year(0) Order No.(1) Party Name(2) Amount Received(3) Amount Return(4) Remark(5)
export default function PartyModule({ setStatus }) {
  const [states, setStates] = useState(['MP', 'CG']);
  const [selectedState, setSelectedState] = useState('MP');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [agents, setAgents] = useState([]);
  const [cycleStartYear, setCycleStartYear] = useState(new Date().getFullYear());
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [parties, setParties] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const cellRefs = useRef(new Map()); // "rowIndex-colIndex" -> element

  useEffect(() => {
    (async () => {
      try {
        const [st, ag] = await Promise.all([api('/states'), api('/agents')]);
        setStates(st.length ? st : ['MP', 'CG']);
        setAgents(ag);
      } catch (err) {
        setStatus(err.message, true);
      }
    })();
  }, [setStatus]);

  useEffect(() => {
    (async () => {
      try {
        const ar = await api(`/areas?state=${selectedState}`);
        setAreas(ar);
        setSelectedAreaId(ar.length ? String(ar[0].id) : '');
      } catch (err) {
        setStatus(err.message, true);
      }
    })();
  }, [selectedState, setStatus]);

  const selectedAgent = agents.find(a => String(a.area_id) === String(selectedAreaId)) || null;
  const selectedAgentId = selectedAgent?.id ?? null;

  const cycleOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) cycleOptions.push(y);

  const load = useCallback(async (agentId, cycle) => {
    if (!agentId) { setParties([]); setSummary(null); setLoaded(false); return; }
    try {
      const data = await api(`/parties?agent_id=${agentId}&cycle_start_year=${cycle}`);
      setParties(data.rows);
      setSummary(data.summary);
      setLoaded(true);
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [setStatus]);

  function loadSheet() {
    if (!selectedAgentId) { setStatus('Select an Area first', true); return; }
    setSelectedCycle(cycleStartYear);
    load(selectedAgentId, cycleStartYear);
  }

  function addBlankRow() {
    if (!selectedAgentId || !selectedCycle) { setStatus('Load a sheet first', true); return; }
    setParties(prev => [...prev, {
      rowKey: `new-${Date.now()}`, agent_id: selectedAgentId, year: selectedCycle,
      order_no: '', party_name: '', amt_received: '', amt_return: '', remark: '',
    }]);
  }

  const setCellRef = (rowIndex, colIndex) => (el) => {
    const key = `${rowIndex}-${colIndex}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  function focusCell(rowIndex, colIndex) {
    const el = cellRefs.current.get(`${rowIndex}-${colIndex}`);
    if (el) el.focus();
  }

  // Enter moves down to the next row's same field, auto-creating a new row if you're on the last one.
  function handleKeyDown(e, rowIndex, colIndex) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === parties.length - 1) {
        addBlankRow();
        setTimeout(() => focusCell(rowIndex + 1, colIndex), 0);
      } else {
        focusCell(rowIndex + 1, colIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, colIndex);
    }
  }

  function updateLocal(idx, field, value) {
    setParties(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function saveRow(idx) {
    const row = parties[idx];
    const payload = {
      agent_id: selectedAgentId, year: Number(row.year) || selectedCycle,
      order_no: row.order_no, party_name: row.party_name,
      amt_received: Number(row.amt_received) || 0, amt_return: Number(row.amt_return) || 0,
      remark: row.remark,
    };
    try {
      let saved;
      if (row.id) {
        saved = await api(`/parties/${row.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        saved = await api('/parties', { method: 'POST', body: JSON.stringify(payload) });
      }
      setParties(prev => prev.map((p, i) => (i === idx ? { ...saved, rowKey: p.rowKey } : p)));
      setStatus('Saved');
      const data = await api(`/parties?agent_id=${selectedAgentId}&cycle_start_year=${selectedCycle}`);
      setSummary(data.summary);
    } catch (err) {
      setStatus(err.message, true);
      window.alert(err.message);
    }
  }

  async function deleteRow(idx) {
    const row = parties[idx];
    if (!window.confirm('Delete this row?')) return;
    try {
      if (row.id) await api(`/parties/${row.id}`, { method: 'DELETE' });
      setParties(prev => prev.filter((_, i) => i !== idx));
      setStatus('Deleted');
      const data = await api(`/parties?agent_id=${selectedAgentId}&cycle_start_year=${selectedCycle}`);
      setSummary(data.summary);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function doExport() {
    if (!selectedAgentId || !selectedCycle) return;
    window.location.href = `${API_BASE}/api/export/parties?agent_id=${selectedAgentId}&cycle_start_year=${selectedCycle}`;
  }

  let totalReceived = 0, totalReturn = 0;
  parties.forEach(p => { totalReceived += Number(p.amt_received) || 0; totalReturn += Number(p.amt_return) || 0; });

  return (
    <>
      <div className="module-title">Parties</div>

      <section className="controls">
        <div className="field">
          <label htmlFor="partyStateSelect">State</label>
          <select id="partyStateSelect" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="partyAreaSelect">Area</label>
          <select id="partyAreaSelect" value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)}>
            {areas.length === 0 && <option value="">No areas</option>}
            {areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Agent</label>
          <input type="text" value={selectedAgent?.name || '—'} readOnly disabled />
        </div>
        <div className="field">
          <label htmlFor="partyCycleSelect">Cycle Start Year</label>
          <select id="partyCycleSelect" value={cycleStartYear} onChange={(e) => setCycleStartYear(Number(e.target.value))}>
            {cycleOptions.map(y => <option key={y} value={y}>{y} - {y + 1} - {y + 2}</option>)}
          </select>
        </div>
        <button onClick={loadSheet}>Load Sheet</button>
        <button onClick={addBlankRow} disabled={!loaded}>+ Add Row</button>
        <button className="secondary" disabled={!loaded} onClick={doExport}>⬇ Export to Excel</button>
      </section>

      {loaded && (
        <>
          <div id="sheetWrap">
            <div className="table-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Order No.</th>
                    <th>Party Name</th>
                    <th>Amount Received</th>
                    <th>Amount Return</th>
                    <th>Remaining Amount</th>
                    <th>Remark</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((row, idx) => {
                    const remaining = (Number(row.amt_received) || 0) - (Number(row.amt_return) || 0);
                    return (
                      <tr key={row.rowKey || row.id}>
                        <td>
                          <select
                            ref={setCellRef(idx, 0)}
                            value={row.year || selectedCycle}
                            onChange={(e) => updateLocal(idx, 'year', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                            onBlur={() => saveRow(idx)}
                          >
                            {summary?.years.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            ref={setCellRef(idx, 1)}
                            type="text" value={row.order_no || ''}
                            onChange={(e) => updateLocal(idx, 'order_no', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                            onBlur={() => saveRow(idx)} />
                        </td>
                        <td className="text-left">
                          <input
                            ref={setCellRef(idx, 2)}
                            type="text" value={row.party_name || ''}
                            onChange={(e) => updateLocal(idx, 'party_name', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                            onBlur={() => saveRow(idx)} />
                        </td>
                        <td>
                          <input
                            ref={setCellRef(idx, 3)}
                            type="text" inputMode="numeric" value={row.amt_received ?? ''}
                            onChange={(e) => updateLocal(idx, 'amt_received', e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                            onBlur={() => saveRow(idx)} />
                        </td>
                        <td>
                          <input
                            ref={setCellRef(idx, 4)}
                            type="text" inputMode="numeric" value={row.amt_return ?? ''}
                            onChange={(e) => updateLocal(idx, 'amt_return', e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                            onBlur={() => saveRow(idx)} />
                        </td>
                        <td><span className="computed-cell">{remaining}</span></td>
                        <td className="text-left">
                          <input
                            ref={setCellRef(idx, 5)}
                            type="text" value={row.remark || ''}
                            onChange={(e) => updateLocal(idx, 'remark', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 5)}
                            onBlur={() => saveRow(idx)} />
                        </td>
                        <td className="delete-col">
                          <button type="button" className="delete-row-btn" onClick={() => deleteRow(idx)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>TOTAL:-</td>
                    <td>{totalReceived || ''}</td>
                    <td>{totalReturn || ''}</td>
                    <td>{totalReceived - totalReturn || ''}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {summary && (
            <div className="summary-tables">
              <h3>NET TOTAL</h3>
              <table className="grid summary-grid">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Amount Received</th>
                    <th>Amount Return</th>
                    <th>Remaining Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.years.map(y => (
                    <tr key={y}>
                      <td>{y}</td>
                      <td>{summary.netTotals[y]?.received || 0}</td>
                      <td>{summary.netTotals[y]?.return || 0}</td>
                      <td>{summary.netTotals[y]?.remaining || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}