import { useState, useEffect, useCallback } from 'react';
import { api, API_BASE } from './api';
import Grid from './Grid';
import NewAgentDialog from './NewAgentDialog';

export default function ChallanModule({ setStatus }) {
  const [agents, setAgents] = useState([]);
  const [bookTypes, setBookTypes] = useState([]);
  const [states, setStates] = useState(['MP', 'CG']);
  const [selectedState, setSelectedState] = useState('MP');
  const [agentSearch, setAgentSearch] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [rows, setRows] = useState([]);
  const [sheetLoaded, setSheetLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadMeta = useCallback(async () => {
    const [ag, bt, st] = await Promise.all([api('/agents'), api('/book-types'), api('/states')]);
    setAgents(ag);
    setBookTypes(bt);
    setStates(st.length ? st : ['MP', 'CG']);
  }, []);

  useEffect(() => {
    loadMeta().catch(err => setStatus(err.message, true));
  }, [loadMeta, setStatus]);

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 1; y++) years.push(y);

  const agentsInState = agents.filter(a => (a.state || 'MP') === selectedState);

  function resolveAgentId() {
    const match = agentsInState.find(a => `${a.name} (${a.area_label})` === agentSearch);
    return match ? match.id : null;
  }

  async function loadSheet() {
    const agentId = resolveAgentId();
    if (!agentId) { setStatus('Please select a valid agent from the list', true); return; }

    setSelectedAgentId(agentId);
    setSelectedYear(year);

    const data = await api(`/challans?agent_id=${agentId}&year=${year}`);
    const maxLen = Math.max(data.challans.length, data.returns.length);
    const combined = [];
    for (let i = 0; i < maxLen; i++) {
      combined.push({ rowKey: `row-${i}-${Date.now()}`, challan: data.challans[i] || null, ret: data.returns[i] || null });
    }
    if (combined.length === 0) combined.push({ rowKey: `row-0-${Date.now()}`, challan: null, ret: null });

    setRows(combined);
    setSheetLoaded(true);
    setStatus('Sheet loaded');
  }

  async function handleCreateAgent({ name, state, region_name, area_code }) {
    try {
      await api('/agents', { method: 'POST', body: JSON.stringify({ name, state, region_name, area_code }) });
      setStatus('Agent created');
      setDialogOpen(false);
      await loadMeta();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function doExport() {
    if (!selectedAgentId || !selectedYear) return;
    window.location.href = `${API_BASE}/api/export/challan-issue?agent_id=${selectedAgentId}&year=${selectedYear}`;
  }

  return (
    <>
      <div className="module-title">चिल्ड्रन बुक स्पेसिमेन जावक विवरण (एजेंट वाइज)</div>

      <section className="controls">
        <div className="field">
          <label htmlFor="stateSelect">State</label>
          <select
            id="stateSelect"
            value={selectedState}
            onChange={(e) => { setSelectedState(e.target.value); setAgentSearch(''); }}
          >
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="agentSearch">Agent Name &amp; Area</label>
          <input
            id="agentSearch"
            list="agentList"
            placeholder="Type to search agent..."
            autoComplete="off"
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
          />
          <datalist id="agentList">
            {agentsInState.map(a => (
              <option key={a.id} value={`${a.name} (${a.area_label})`} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="yearSelect">Year</label>
          <select id="yearSelect" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={() => loadSheet().catch(err => setStatus(err.message, true))}>Load Sheet</button>
        <button className="secondary" onClick={() => setDialogOpen(true)}>+ New Agent</button>
        <button className="secondary" disabled={!sheetLoaded} onClick={doExport}>⬇ Export to Excel</button>
      </section>

      {sheetLoaded && (
        <Grid
          rows={rows}
          setRows={setRows}
          agentId={selectedAgentId}
          year={selectedYear}
          setStatus={setStatus}
        />
      )}

      <NewAgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreateAgent}
      />
    </>
  );
}