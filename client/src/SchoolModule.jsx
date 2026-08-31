import { useState, useEffect, useRef, useCallback } from 'react';
import { api, API_BASE } from './api';

const LIST_TABS = [
  { key: 'MASTER', label: 'School Master List' },
  { key: 'MASTER_NEW', label: 'School Master List (NEW)' },
  { key: 'CBSE', label: 'CBSE' },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Field/label pairs, in the exact sequence from the reference sheet.
// specimen_given_2021/22/23 = "Specimen Given Yogya" (reused from before so existing data carries over)
const COLUMNS = [
  ['school_code', 'School Code'],
  ['school_name_address', 'School Name / Address'],
  ['principal_name_mobile', 'Principal Name / Mobile No.'],
  ['grade', 'Grade'],
  ['medium', 'Medium'],
  ['board', 'Board'],
  ['specimen_give_month', 'Specimen Give Month'],
  ['book_delivery_month', 'Book Delivery Month'],

  ['specimen_given_2021', '2021 Specimen Given Yogya'],
  ['specimen_given_ayogya_2021', '2021 Specimen Given Ayogya'],
  ['TOTAL_DISTRIBUTE_2021', '2021 Total Spec. Distribute'],
  ['specimen_returned_2021', '2021 Specimen Returned'],
  ['NET_SPE_2021', '2021 NET SPE'],

  ['specimen_given_2022', '2022 Specimen Given Yogya'],
  ['specimen_given_ayogya_2022', '2022 Specimen Given Ayogya'],
  ['TOTAL_DISTRIBUTE_2022', '2022 Total Spec. Distribute'],
  ['specimen_returned_2022', '2022 Specimen Returned'],
  ['NET_SPE_2022', '2022 NET SPE'],

  ['specimen_given_2023', '2023 Specimen Given Yogya'],
  ['specimen_given_ayogya_2023', '2023 Specimen Given Ayogya'],
  ['TOTAL_DISTRIBUTE_2023', '2023 Total Spec. Distribute'],
  ['specimen_returned_2023', '2023 Specimen Returned'],
  ['NET_SPE_2023', '2023 NET SPE'],

  ['sale_details_2021', '2021 Sale Details'],
  ['sale_return_2021', '2021 Sale Return'],
  ['NET_SALE_2021', '2021 Net Sale'],

  ['sale_details_2022', '2022 Sale Details'],
  ['sale_return_2022', '2022 Sale Return'],
  ['NET_SALE_2022', '2022 Net Sale'],

  ['sale_details_2023', '2023 Sale Details'],
  ['sale_return_2023', '2023 Sale Return'],
  ['NET_SALE_2023', '2023 Net Sale'],

  ['visit_1', 'School Visit Date / App Location - I'],
  ['visit_2', 'School Visit Date / App Location - II'],
  ['visit_3', 'School Visit Date / App Location - III'],

  ['supplying_party', 'Supplying Party'],
  ['discussion_2023', 'Discussion 2023'],
  ['discussion_2024', 'Discussion 2024'],
  ['remark', 'Remark'],
];

const COMPUTED = {
  TOTAL_DISTRIBUTE_2021: s => (Number(s.specimen_given_2021) || 0) + (Number(s.specimen_given_ayogya_2021) || 0),
  TOTAL_DISTRIBUTE_2022: s => (Number(s.specimen_given_2022) || 0) + (Number(s.specimen_given_ayogya_2022) || 0),
  TOTAL_DISTRIBUTE_2023: s => (Number(s.specimen_given_2023) || 0) + (Number(s.specimen_given_ayogya_2023) || 0),
  NET_SPE_2021: s => ((Number(s.specimen_given_2021) || 0) + (Number(s.specimen_given_ayogya_2021) || 0)) - (Number(s.specimen_returned_2021) || 0),
  NET_SPE_2022: s => ((Number(s.specimen_given_2022) || 0) + (Number(s.specimen_given_ayogya_2022) || 0)) - (Number(s.specimen_returned_2022) || 0),
  NET_SPE_2023: s => ((Number(s.specimen_given_2023) || 0) + (Number(s.specimen_given_ayogya_2023) || 0)) - (Number(s.specimen_returned_2023) || 0),
  NET_SALE_2021: s => (Number(s.sale_details_2021) || 0) - (Number(s.sale_return_2021) || 0),
  NET_SALE_2022: s => (Number(s.sale_details_2022) || 0) - (Number(s.sale_return_2022) || 0),
  NET_SALE_2023: s => (Number(s.sale_details_2023) || 0) - (Number(s.sale_return_2023) || 0),
};

const NUMERIC_FIELDS = new Set([
  'specimen_given_2021', 'specimen_given_ayogya_2021', 'specimen_returned_2021',
  'specimen_given_2022', 'specimen_given_ayogya_2022', 'specimen_returned_2022',
  'specimen_given_2023', 'specimen_given_ayogya_2023', 'specimen_returned_2023',
  'sale_details_2021', 'sale_return_2021',
  'sale_details_2022', 'sale_return_2022',
  'sale_details_2023', 'sale_return_2023',
]);
const TEXTAREA_FIELDS = new Set(['school_name_address', 'principal_name_mobile', 'discussion_2023', 'discussion_2024', 'remark']);
const MONTH_FIELDS = new Set(['specimen_give_month', 'book_delivery_month']);

// Same key definition used server-side for duplicate detection: School Code + School Name/Address
function dupKey(s) {
  const code = (s.school_code || '').trim().toLowerCase();
  const name = (s.school_name_address || '').trim().toLowerCase();
  if (!code && !name) return null;
  return `${code}|${name}`;
}

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
  const cellRefs = useRef(new Map());
  // Always holds the CURRENT schools array. saveSchool reads from this ref (not a
  // closure over `schools`) so a debounced save firing 400ms later always picks up
  // every keystroke typed in the meantime, instead of overwriting them with whatever
  // was in state when the save was first scheduled. Without this, the very first
  // character typed into a brand-new row could get silently wiped out when the
  // debounced save fired with stale (empty) data and replaced the row with the
  // server's response.
  const schoolsRef = useRef(schools);
  useEffect(() => { schoolsRef.current = schools; }, [schools]);

  const [states, setStates] = useState(['MP', 'CG']);
  const [selectedState, setSelectedState] = useState('MP');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [agents, setAgents] = useState([]);

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

  const duplicateIds = (() => {
    const counts = new Map();
    for (const s of schools) {
      const key = dupKey(s);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const ids = new Set();
    for (const s of schools) {
      const key = dupKey(s);
      if (key && counts.get(key) > 1) ids.add(s.id);
    }
    return ids;
  })();

  const filtered = search.trim()
    ? schools.filter(s =>
        (s.school_name_address || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.school_code || '').toLowerCase().includes(search.toLowerCase()))
    : schools;

  const totals = {};
  for (const [field] of COLUMNS) {
    if (NUMERIC_FIELDS.has(field) || COMPUTED[field]) {
      totals[field] = filtered.reduce((sum, s) => {
        const v = COMPUTED[field] ? COMPUTED[field](s) : Number(s[field]) || 0;
        return sum + (Number(v) || 0);
      }, 0);
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  function updateLocal(id, field, value) {
    setSchools(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  }

  const setCellRef = (rowIndex, colIndex) => (el) => {
    const key = `${rowIndex}-${colIndex}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  function handleCellKeyDown(e, rowIndex, colIndex) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = cellRefs.current.get(`${rowIndex + 1}-${colIndex}`);
      if (next) next.focus();
    }
  }

  // Reads from schoolsRef.current (always fresh) rather than closing over the
  // `schools` state variable, so this always saves whatever was most recently typed —
  // even if this exact function instance was scheduled several keystrokes ago.
  const saveSchool = useCallback(async (id) => {
    const school = schoolsRef.current.find(s => s.id === id);
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
  }, [listType, setStatus]);

  const queueSave = useCallback((id) => {
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => saveSchool(id), 400);
  }, [saveSchool]);

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
    e.target.value = '';
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

  async function handleDedupe() {
    if (!window.confirm(`Remove duplicate schools from "${listType}"? This keeps the first copy of each and deletes the rest. This cannot be undone.`)) return;
    try {
      const result = await api('/schools/dedupe', { method: 'POST', body: JSON.stringify({ list_type: listType }) });
      setStatus(`Removed ${result.removed} duplicate rows`);
      await load(listType, selectedAgentId);
    } catch (err) {
      setStatus(err.message, true);
      window.alert(err.message);
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
        <button className="secondary" onClick={handleDedupe}>🧹 Clean Duplicates</button>
        <span className="status">
          {loading ? 'Loading...' : `${filtered.length} schools`}
          {duplicateIds.size > 0 && <span style={{ color: '#b00020', fontWeight: 'bold' }}> — {duplicateIds.size} duplicate rows highlighted in red</span>}
        </span>
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
                  rowIndex={idx}
                  updateLocal={updateLocal}
                  queueSave={queueSave}
                  onDelete={() => deleteSchool(school.id)}
                  isDuplicate={duplicateIds.has(school.id)}
                  setCellRef={setCellRef}
                  handleCellKeyDown={handleCellKeyDown}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL:-</td>
                {COLUMNS.map(([field]) => (
                  <td key={field}>{totals[field] !== undefined ? totals[field] : ''}</td>
                ))}
                <td></td>
              </tr>
            </tfoot>
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

function SchoolRow({ school, index, rowIndex, updateLocal, queueSave, onDelete, isDuplicate, setCellRef, handleCellKeyDown }) {
  function handleChange(field, value) {
    updateLocal(school.id, field, value);
    queueSave(school.id);
  }

  return (
    <tr className={isDuplicate ? 'duplicate-row' : ''}>
      <td>{index + 1}</td>
      {COLUMNS.map(([field], colIndex) => (
        <td key={field} className={TEXTAREA_FIELDS.has(field) ? 'text-left' : ''}>
          {COMPUTED[field] ? (
            <span className="computed-cell">{COMPUTED[field](school)}</span>
          ) : MONTH_FIELDS.has(field) ? (
            <select
              ref={setCellRef(rowIndex, colIndex)}
              value={school[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
            >
              <option value=""></option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : TEXTAREA_FIELDS.has(field) ? (
            <textarea
              ref={setCellRef(rowIndex, colIndex)}
              rows={2}
              value={school[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
            />
          ) : NUMERIC_FIELDS.has(field) ? (
            <input
              ref={setCellRef(rowIndex, colIndex)}
              type="text"
              inputMode="numeric"
              value={school[field] ?? ''}
              onChange={(e) => handleChange(field, e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
            />
          ) : (
            <input
              ref={setCellRef(rowIndex, colIndex)}
              type="text"
              value={school[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
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