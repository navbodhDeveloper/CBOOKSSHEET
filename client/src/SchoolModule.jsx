import { useState, useEffect, useRef, useCallback } from 'react';
import { api, API_BASE } from './api';

const LIST_TABS = [
  { key: 'MASTER', label: 'School Master List' },
  { key: 'MASTER_NEW', label: 'School Master List (NEW)' },
  { key: 'CBSE', label: 'CBSE' },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// [field, header label] — stored fields
const COLUMNS = [
  ['school_code', 'School Code'],
  ['school_name_address', 'School Name / Address'],
  ['principal_name_mobile', 'Principal Name / Mobile No.'],
  ['grade', 'Grade'],
  ['medium', 'Medium'],
  ['board', 'Board'],
  ['specimen_give_month', 'Specimen Give Month'],
  ['book_delivery_month', 'Book Delivery Month'],
  ['specimen_given_2021', 'Specimen Given 2021'],
  ['specimen_given_2022', 'Specimen Given 2022'],
  ['specimen_given_2023', 'Specimen Given 2023'],
  ['specimen_returned_2021', 'Specimen Returned 2021'],
  ['specimen_returned_2022', 'Specimen Returned 2022'],
  ['specimen_returned_2023', 'Specimen Returned 2023'],
  ['NET_SPE_2021', '2021 NET SPE'],
  ['NET_SPE_2022', '2022 NET SPE'],
  ['NET_SPE_2023', '2023 NET SPE'],
  ['visit_1', '(Date/Location)'],
  ['visit_2', '(Date/Location)'],
  ['visit_3', '(Date/Location)'],
  ['order_2021', '21 Order'],
  ['vapasi_2021', '21 Vapasi'],
  ['NET_ORDER_2021', '21 Net Order'],
  ['order_2022', '22 Order'],
  ['vapasi_2022', '22 Vapasi'],
  ['NET_ORDER_2022', '22 Net Order'],
  ['order_2023', '23 Order'],
  ['vapasi_2023', '23 Vapasi'],
  ['NET_ORDER_2023', '23 Net Order'],
  ['yog_amt', 'Yog'],
  ['ayog_amt', 'Ayog'],
  ['total_amt', 'Total'],
  ['REMAINING', 'Remaning'],
  ['supplying_party', 'Supplying Party'],
  ['discussion_2023', 'Discussion 2023'],
  ['discussion_2024', 'Discussion 2024'],
  ['remark', 'Remark'],
];

// Computed, read-only: NET_SPE = given - returned, NET_ORDER = order - vapasi
const COMPUTED = {
  NET_SPE_2021: s => (Number(s.specimen_given_2021) || 0) - (Number(s.specimen_returned_2021) || 0),
  NET_SPE_2022: s => (Number(s.specimen_given_2022) || 0) - (Number(s.specimen_returned_2022) || 0),
  NET_SPE_2023: s => (Number(s.specimen_given_2023) || 0) - (Number(s.specimen_returned_2023) || 0),
  NET_ORDER_2021: s => (Number(s.order_2021) || 0) - (Number(s.vapasi_2021) || 0),
  NET_ORDER_2022: s => (Number(s.order_2022) || 0) - (Number(s.vapasi_2022) || 0),
  NET_ORDER_2023: s => (Number(s.order_2023) || 0) - (Number(s.vapasi_2023) || 0),
  REMAINING: s => (Number(s.total_amt) || 0) - (Number(s.yog_amt) || 0) - (Number(s.ayog_amt) || 0),
};

const NUMERIC_FIELDS = new Set([
  'specimen_given_2021', 'specimen_given_2022', 'specimen_given_2023',
  'specimen_returned_2021', 'specimen_returned_2022', 'specimen_returned_2023',
  'order_2021', 'vapasi_2021', 'order_2022', 'vapasi_2022', 'order_2023', 'vapasi_2023',
  'yog_amt', 'ayog_amt', 'total_amt',
]);
const TEXTAREA_FIELDS = new Set(['school_name_address', 'principal_name_mobile', 'discussion_2023', 'discussion_2024', 'remark']);
const MONTH_FIELDS = new Set(['specimen_give_month', 'book_delivery_month']);

export default function SchoolModule({ setStatus }) {
  const [listType, setListType] = useState('MASTER');
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [importing, setImporting] = useState(false);
  const saveTimers = useRef({});
  const fileInputRef = useRef(null);

  const [states, setStates] = useState(['MP', 'CG']);
  const [selectedState, setSelectedState] = useState('MP');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [agents, setAgents] = useState([]);

  // Load states + agents once
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

  // Load areas whenever the state changes, and auto-pick the first one
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

  // The agent is auto-derived from the selected area (each area has exactly one agent)
  const selectedAgent = agents.find(a => String(a.area_id) === String(selectedAreaId)) || null;
  const selectedAgentId = selectedAgent?.id ?? null;

  const load = useCallback(async (lt, agentId) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ list_type: lt });
      if (agentId) qs.set('agent_id', agentId);
      const data = await api(`/schools?${qs.toString()}`);
      setSchools(data);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      setLoading(false);
    }
  }, [setStatus]);

  useEffect(() => { load(listType, selectedAgentId); setPage(1); }, [listType, selectedAgentId, load]);
  useEffect(() => { setPage(1); }, [search, pageSize]);

  const filtered = search.trim()
    ? schools.filter(s =>
        (s.school_name_address || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.school_code || '').toLowerCase().includes(search.toLowerCase()))
    : schools;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  function updateLocal(id, field, value) {
    setSchools(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function queueSave(id) {
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => saveSchool(id), 400);
  }

  async function saveSchool(id) {
    const school = schools.find(s => s.id === id);
    if (!school) return;
    try {
      if (String(id).startsWith('new-')) {
        const { id: newId, list_type, ...fields } = school;
        const created = await api('/schools', { method: 'POST', body: JSON.stringify({ list_type: listType, ...fields }) });
        setSchools(prev => prev.map(s => (s.id === id ? created : s)));
      } else {
        await api(`/schools/${id}`, { method: 'PUT', body: JSON.stringify(school) });
      }
      setStatus('Saved');
    } catch (err) {
      setStatus(err.message, true);
      window.alert(err.message);
    }
  }

  function addBlankSchool() {
    const tempId = `new-${Date.now()}`;
    const blank = { id: tempId, list_type: listType, agent_id: selectedAgentId };
    for (const [field] of COLUMNS) blank[field] = '';
    setSchools(prev => [blank, ...prev]);
    setPage(1);
  }

  async function deleteSchool(id) {
    if (!window.confirm('Delete this school? This cannot be undone.')) return;
    try {
      if (!String(id).startsWith('new-')) {
        await api(`/schools/${id}`, { method: 'DELETE' });
      }
      setSchools(prev => prev.filter(s => s.id !== id));
      setStatus('School deleted');
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function doExport() {
    const qs = new URLSearchParams({ list_type: listType });
    if (selectedAgentId) qs.set('agent_id', selectedAgentId);
    window.location.href = `${API_BASE}/api/export/school-list?${qs.toString()}`;
  }

  function handleImportClick() {
    if (!selectedAgentId) { setStatus('Select an Area first — imported schools need an owning agent', true); return; }
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setImporting(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api('/schools/import', {
        method: 'POST',
        body: JSON.stringify({ list_type: listType, agent_id: selectedAgentId, fileBase64: base64 }),
      });
      setStatus(`Imported ${result.imported} schools${result.skipped ? `, skipped ${result.skipped} duplicates` : ''}`);
      await load(listType, selectedAgentId);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="module-title">School Master List</div>

      <section className="controls">
        <div className="field">
          <label htmlFor="schoolStateSelect">State</label>
          <select id="schoolStateSelect" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="schoolAreaSelect">Area</label>
          <select id="schoolAreaSelect" value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)}>
            {areas.length === 0 && <option value="">No areas</option>}
            {areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Agent</label>
          <input type="text" value={selectedAgent?.name || '—'} readOnly disabled />
        </div>
        <div className="tabs">
          {LIST_TABS.map(t => (
            <button
              key={t.key}
              className={`tab-btn ${listType === t.key ? 'active' : ''}`}
              onClick={() => setListType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="schoolSearch">Search</label>
          <input
            id="schoolSearch"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pageSize">Rows per page</label>
          <select id="pageSize" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <button onClick={addBlankSchool}>+ Add School</button>
        <button className="secondary" onClick={handleImportClick} disabled={importing}>
          {importing ? 'Importing...' : '⬆ Import from Excel'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        <button className="secondary" onClick={doExport}>⬇ Export to Excel</button>
        <span className="status">{loading ? 'Loading...' : `${filtered.length} schools`}</span>
      </section>

      <div id="sheetWrap">
        <div className="table-scroll">
          <table className="grid school-grid">
            <thead>
              <tr>
                <th>S.N.</th>
                {COLUMNS.map(([field, label]) => <th key={field}>{label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((school, idx) => (
                <SchoolRow
                  key={school.id}
                  school={school}
                  index={pageStart + idx}
                  updateLocal={updateLocal}
                  queueSave={queueSave}
                  onDelete={() => deleteSchool(school.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button className="secondary" disabled={safePage <= 1} onClick={() => setPage(1)}>« First</button>
          <button className="secondary" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
          <span className="page-info">Page {safePage} of {totalPages}</span>
          <button className="secondary" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
          <button className="secondary" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>Last »</button>
        </div>
      </div>
    </>
  );
}

function SchoolRow({ school, index, updateLocal, queueSave, onDelete }) {
  function handleChange(field, value) {
    updateLocal(school.id, field, value);
    queueSave(school.id);
  }

  return (
    <tr>
      <td>{index + 1}</td>
      {COLUMNS.map(([field]) => (
        <td key={field} className={TEXTAREA_FIELDS.has(field) ? 'text-left' : ''}>
          {COMPUTED[field] ? (
            <span className="computed-cell">{COMPUTED[field](school)}</span>
          ) : MONTH_FIELDS.has(field) ? (
            <select value={school[field] || ''} onChange={(e) => handleChange(field, e.target.value)}>
              <option value=""></option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : TEXTAREA_FIELDS.has(field) ? (
            <textarea
              rows={2}
              value={school[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
            />
          ) : NUMERIC_FIELDS.has(field) ? (
            <input
              type="text"
              inputMode="numeric"
              value={school[field] ?? ''}
              onChange={(e) => handleChange(field, e.target.value.replace(/[^0-9]/g, ''))}
            />
          ) : (
            <input
              type="text"
              value={school[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
            />
          )}
        </td>
      ))}
      <td className="delete-col">
        <button type="button" className="delete-row-btn" title="Delete school" onClick={onDelete}>✕</button>
      </td>
    </tr>
  );
}