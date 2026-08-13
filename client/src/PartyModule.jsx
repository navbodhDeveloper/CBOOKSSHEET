import { useState, useEffect, useCallback } from 'react';
import { api, API_BASE } from './api';

export default function PartyModule({ setStatus }) {
  const [states, setStates] = useState(['MP', 'CG']);
  const [selectedState, setSelectedState] = useState('MP');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [agents, setAgents] = useState([]);
  const [parties, setParties] = useState([]);

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

  const load = useCallback(async (agentId) => {
    if (!agentId) { setParties([]); return; }
    try {
      const data = await api(`/parties?agent_id=${agentId}`);
      setParties(data);
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [setStatus]);

  useEffect(() => { load(selectedAgentId); }, [selectedAgentId, load]);

  function addBlankRow() {
    if (!selectedAgentId) { setStatus('Select an Area first', true); return; }
    setParties(prev => [...prev, {
      rowKey: `new-${Date.now()}`, agent_id: selectedAgentId,
      order_no: '', party_name: '', amt_received: '', amt_return: '', remark: '',
    }]);
  }

  function updateLocal(idx, field, value) {
    setParties(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function saveRow(idx) {
    const row = parties[idx];
    const payload = {
      agent_id: selectedAgentId,
      order_no: row.order_no, party_name: row.party_name,
      amt_received: Number(row.amt_received) || 0, amt_return: Number(row.amt_return) || 0,
      remark: row.remark || '',
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
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  async function deleteRow(idx) {
    const row = parties[idx];
    if (!window.confirm('Delete this row?')) return;
    try {
      if (row.id) await api(`/parties/${row.id}`, { method: 'DELETE' });
      setParties(prev => prev.filter((_, i) => i !== idx));
      setStatus('Deleted');
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function doExport() {
    if (!selectedAgentId) return;
    window.location.href = `${API_BASE}/api/export/parties?agent_id=${selectedAgentId}`;
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
        <button onClick={addBlankRow}>+ Add Row</button>
        <button className="secondary" disabled={!selectedAgentId} onClick={doExport}>⬇ Export to Excel</button>
      </section>

      <div id="sheetWrap">
        <div className="table-scroll">
          <table className="grid">
            <thead>
              <tr>
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
                      <input type="text" value={row.order_no || ''}
                        onChange={(e) => updateLocal(idx, 'order_no', e.target.value)}
                        onBlur={() => saveRow(idx)} />
                    </td>
                    <td className="text-left">
                      <input type="text" value={row.party_name || ''}
                        onChange={(e) => updateLocal(idx, 'party_name', e.target.value)}
                        onBlur={() => saveRow(idx)} />
                    </td>
                    <td>
                      <input type="text" inputMode="numeric" value={row.amt_received ?? ''}
                        onChange={(e) => updateLocal(idx, 'amt_received', e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => saveRow(idx)} />
                    </td>
                    <td>
                      <input type="text" inputMode="numeric" value={row.amt_return ?? ''}
                        onChange={(e) => updateLocal(idx, 'amt_return', e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => saveRow(idx)} />
                    </td>
                    <td><span className="computed-cell">{remaining}</span></td>
                    <td className="text-left">
                      <input type="text" value={row.remark || ''}
                        onChange={(e) => updateLocal(idx, 'remark', e.target.value)}
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
                <td colSpan={2}>TOTAL:-</td>
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
    </>
  );
}