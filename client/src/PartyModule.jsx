import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { api, API_BASE } from './api';

// Each row = one Party spanning a 3-year cycle.
// S.N. is auto-computed from row position (not a stored/editable field — see render below).
// Column order for keyboard navigation: Party Name(1)
// then per year: Sale Details, Sale Return (Net Sale is computed, not focusable)
// then Remark last.
export default function PartyModule({ setStatus }) {
  const [states, setStates] = useState(['MP', 'CG']);
  const [selectedState, setSelectedState] = useState('MP');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [agents, setAgents] = useState([]);
  const [agentNameInput, setAgentNameInput] = useState('');
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

  // Keep the editable agent-name field in sync whenever the underlying agent changes
  // (e.g. switching Area), without clobbering what the user is actively typing.
  useEffect(() => {
    setAgentNameInput(selectedAgent?.name || '');
  }, [selectedAreaId, selectedAgent?.name]);

  // IMPORTANT: this is a DISPLAY-ONLY override used solely when exporting to Excel
  // (e.g. someone temporarily covering another agent's area for a day or two).
  // It is never sent to the server and never renames the real agent record —
  // selectedAgent / agents stays untouched no matter what's typed here.
  function handleAgentNameBlur() {
    const trimmed = agentNameInput.trim();
    if (!trimmed) setAgentNameInput(selectedAgent?.name || '');
  }


  const cycleOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) cycleOptions.push(y);

  // The 3 years covered by whichever cycle is currently loaded.
  const years = selectedCycle ? [selectedCycle, selectedCycle + 1, selectedCycle + 2] : [];

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

  // A row counts as "started" if it has a Party Name, a Remark, or any non-zero
  // Sale Details/Sale Return figure in any year of the current cycle. Used to stop
  // the user from stacking up empty blank rows before finishing the current one.
  function rowHasData(row) {
    if (!row) return false;
    if ((row.party_name || '').trim()) return true;
    if ((row.remark || '').trim()) return true;
    return years.some(y => (Number(row[`sale_details_${y}`]) || 0) !== 0 || (Number(row[`sale_return_${y}`]) || 0) !== 0);
  }

  const sortByName = useCallback(async () => {
    const sorted = [...parties].sort((a, b) => (a.party_name || '').localeCompare(b.party_name || '', undefined, { sensitivity: 'base' }));
    setParties(sorted);
    try {
      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i];
        if (!row.id) continue;
        const payload = {
          agent_id: selectedAgentId, cycle_start_year: selectedCycle,
          s_no: i + 1, party_name: row.party_name, remark: row.remark,
        };
        years.forEach(y => {
          payload[`sale_details_${y}`] = Number(row[`sale_details_${y}`]) || 0;
          payload[`sale_return_${y}`] = Number(row[`sale_return_${y}`]) || 0;
        });
        await api(`/parties/${row.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      setStatus('Sorted by Party Name');
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [parties, selectedAgentId, selectedCycle, years, setStatus]);

  function addBlankRow() {
    if (!selectedAgentId || !selectedCycle) { setStatus('Load a sheet first', true); return false; }
    if (parties.length > 0 && !rowHasData(parties[parties.length - 1])) {
      setStatus('Please fill in the current row (Party Name or an amount) before adding a new one', true);
      return false;
    }
    const blank = {
      rowKey: `new-${Date.now()}`,
      agent_id: selectedAgentId,
      cycle_start_year: selectedCycle,
      party_name: '',
      remark: '',
    };
    years.forEach(y => {
      blank[`sale_details_${y}`] = '';
      blank[`sale_return_${y}`] = '';
    });
    setParties(prev => [...prev, blank]);
    return true;
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

  // Enter moves down to the next row's same field, auto-creating a new row if you're on
  // the last one — but only if that last row already has something in it.
  function handleKeyDown(e, rowIndex, colIndex) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === parties.length - 1) {
        const added = addBlankRow();
        if (added) setTimeout(() => focusCell(rowIndex + 1, colIndex), 0);
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
      agent_id: selectedAgentId,
      cycle_start_year: selectedCycle,
      // S.N. is always the row's position on the sheet — never typed, never stored as a
      // separate editable value, so it can't go out of sequence or duplicate.
      s_no: idx + 1,
      party_name: row.party_name,
      remark: row.remark,
    };
    years.forEach(y => {
      payload[`sale_details_${y}`] = Number(row[`sale_details_${y}`]) || 0;
      payload[`sale_return_${y}`] = Number(row[`sale_return_${y}`]) || 0;
    });
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
    const params = new URLSearchParams({ agent_id: selectedAgentId, cycle_start_year: selectedCycle });
    const trimmed = agentNameInput.trim();
    if (trimmed && trimmed !== selectedAgent?.name) {
      params.set('agent_display_name', trimmed);
    }
    window.location.href = `${API_BASE}/api/export/parties?${params.toString()}`;
  }

  // Live totals across all currently-loaded rows (including unsaved edits), one set per year.
  const totals = {};
  years.forEach(y => {
    const dKey = `sale_details_${y}`;
    const rKey = `sale_return_${y}`;
    const details = parties.reduce((s, p) => s + (Number(p[dKey]) || 0), 0);
    const ret = parties.reduce((s, p) => s + (Number(p[rKey]) || 0), 0);
    totals[y] = { details, ret, net: details - ret };
  });

  const remarkColIndex = 2 + years.length * 2;

  // Party-wise totals: same party name can appear on multiple rows (repeat orders),
  // so group by trimmed/case-insensitive name and sum PER YEAR (not flattened) so the
  // breakdown matches how the main grid and export show data — year by year.
  const partyYearTotalsMap = {};
  parties.forEach(p => {
    const name = (p.party_name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!partyYearTotalsMap[key]) {
      partyYearTotalsMap[key] = { name, years: {} };
      years.forEach(y => { partyYearTotalsMap[key].years[y] = { details: 0, ret: 0 }; });
    }
    years.forEach(y => {
      partyYearTotalsMap[key].years[y].details += Number(p[`sale_details_${y}`]) || 0;
      partyYearTotalsMap[key].years[y].ret += Number(p[`sale_return_${y}`]) || 0;
    });
  });
  const partyYearTotalsList = Object.values(partyYearTotalsMap).sort((a, b) => a.name.localeCompare(b.name));

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
          <label htmlFor="partyAgentInput">Agent</label>
          <input
            id="partyAgentInput"
            type="text"
            value={agentNameInput}
            onChange={(e) => setAgentNameInput(e.target.value)}
            onBlur={handleAgentNameBlur}
            disabled={!selectedAgent}
          />
          <small style={{ color: '#666' }}>For export only — doesn't rename the agent</small>
        </div>
        <div className="field">
          <label htmlFor="partyCycleSelect">Cycle Start Year</label>
          <select id="partyCycleSelect" value={cycleStartYear} onChange={(e) => setCycleStartYear(Number(e.target.value))}>
            {cycleOptions.map(y => <option key={y} value={y}>{y} - {y + 1} - {y + 2}</option>)}
          </select>
        </div>
        <button onClick={loadSheet}>Load Sheet</button>
        <button onClick={addBlankRow} disabled={!loaded}>+ Add Row</button>
        <button className="secondary" disabled={!loaded} onClick={sortByName}>⇅ Sort by Name</button>
        <button className="secondary" disabled={!loaded} onClick={doExport}>⬇ Export to Excel</button>
      </section>

      {loaded && (
        <>
          <div id="sheetWrap">
            <div className="table-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th rowSpan={2}>S.N.</th>
                    <th rowSpan={2} style={{ minWidth: 220 }}>Party Name</th>
                    {years.map(y => <th key={y} colSpan={3}>{y}</th>)}
                    <th rowSpan={2}>Remark</th>
                    <th rowSpan={2}></th>
                  </tr>
                  <tr>
                    {years.map(y => (
                      <Fragment key={y}>
                        <th>Sale Details</th>
                        <th>Sale Return</th>
                        <th style={{ minWidth: 110, fontSize: '1.05em' }}>Net Sale</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parties.map((row, idx) => (
                    <tr key={row.rowKey || row.id}>
                      {/* S.N. is always the row's position on the sheet — plain display,
                          not an input, so it can never be typed differently or end up
                          duplicated/out of sequence. */}
                      <td>{idx + 1}</td>
                      <td className="text-left">
                        <textarea
                          ref={setCellRef(idx, 1)}
                          rows={2} style={{ width: '100%', minWidth: 200, resize: 'vertical' }}
                          value={row.party_name || ''}
                          onChange={(e) => updateLocal(idx, 'party_name', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          onBlur={() => saveRow(idx)} />
                      </td>
                      {years.map((y, yIdx) => {
                        const dCol = 2 + yIdx * 2;
                        const rCol = 3 + yIdx * 2;
                        const dKey = `sale_details_${y}`;
                        const rKey = `sale_return_${y}`;
                        const details = Number(row[dKey]) || 0;
                        const ret = Number(row[rKey]) || 0;
                        const net = details - ret;
                        return (
                          <Fragment key={y}>
                            <td>
                              <input
                                ref={setCellRef(idx, dCol)}
                                type="text" inputMode="numeric" value={row[dKey] ?? ''}
                                onChange={(e) => updateLocal(idx, dKey, e.target.value.replace(/[^0-9]/g, ''))}
                                onKeyDown={(e) => handleKeyDown(e, idx, dCol)}
                                onBlur={() => saveRow(idx)} />
                            </td>
                            <td>
                              <input
                                ref={setCellRef(idx, rCol)}
                                type="text" inputMode="numeric" value={row[rKey] ?? ''}
                                onChange={(e) => updateLocal(idx, rKey, e.target.value.replace(/[^0-9]/g, ''))}
                                onKeyDown={(e) => handleKeyDown(e, idx, rCol)}
                                onBlur={() => saveRow(idx)} />
                            </td>
                            <td style={{ minWidth: 110 }}>
                              <span className="computed-cell" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>{net}</span>
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className="text-left">
                        <input
                          ref={setCellRef(idx, remarkColIndex)}
                          type="text" value={row.remark || ''}
                          onChange={(e) => updateLocal(idx, 'remark', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, remarkColIndex)}
                          onBlur={() => saveRow(idx)} />
                      </td>
                      <td className="delete-col">
                        <button type="button" className="delete-row-btn" onClick={() => deleteRow(idx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>TOTAL:-</td>
                    {years.map(y => (
                      <Fragment key={y}>
                        <td>{totals[y]?.details || ''}</td>
                        <td>{totals[y]?.ret || ''}</td>
                        <td>{totals[y]?.net || ''}</td>
                      </Fragment>
                    ))}
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
                    <th>Sale Details</th>
                    <th>Sale Return</th>
                    <th>Net Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.years.map(y => (
                    <tr key={y}>
                      <td>{y}</td>
                      <td>{summary.netTotals[y]?.details || 0}</td>
                      <td>{summary.netTotals[y]?.return || 0}</td>
                      <td>{summary.netTotals[y]?.net || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {partyYearTotalsList.length > 0 && (
            <div className="summary-tables">
              <h3>Party-wise Total</h3>
              <div className="table-scroll">
                <table className="grid summary-grid">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Party Name</th>
                      {years.map(y => <th key={y} colSpan={3}>{y}</th>)}
                    </tr>
                    <tr>
                      {years.map(y => (
                        <Fragment key={y}>
                          <th>Sale Details</th>
                          <th>Sale Return</th>
                          <th>Net Sale</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partyYearTotalsList.map(pt => (
                      <tr key={pt.name}>
                        <td className="text-left">{pt.name}</td>
                        {years.map(y => {
                          const yd = pt.years[y];
                          return (
                            <Fragment key={y}>
                              <td>{yd.details}</td>
                              <td>{yd.ret}</td>
                              <td>{yd.details - yd.ret}</td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}