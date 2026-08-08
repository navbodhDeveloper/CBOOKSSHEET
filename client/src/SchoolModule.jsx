import { useState, useEffect, useRef, useCallback } from 'react';
import { api, API_BASE } from './api';

const LIST_TABS = [
  { key: 'MASTER', label: 'School Master List' },
  { key: 'MASTER_NEW', label: 'School Master List (NEW)' },
  { key: 'CBSE', label: 'CBSE' },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// [field, header label]
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
  ['books_finalized_2021', 'Books Finalized 2021'],
  ['books_finalized_2022', 'Books Finalized 2022'],
  ['books_finalized_2023', 'Books Finalized 2023'],
  ['gift_given', 'Gift Given'],
  ['visit_1', 'Visit I (Date/Location)'],
  ['visit_2', 'Visit II (Date/Location)'],
  ['visit_3', 'Visit III (Date/Location)'],
  ['dist_2024_distributed', '2024 Distributed'],
  ['dist_2024_returned', '2024 Returned'],
  ['dist_2024_net', '2024 Net'],
  ['supplying_party', 'Supplying Party'],
  ['discussion_2024', 'Discussion 2024'],
  ['remark', 'Remark'],
];

const NUMERIC_FIELDS = new Set([
  'specimen_given_2021', 'specimen_given_2022', 'specimen_given_2023',
  'specimen_returned_2021', 'specimen_returned_2022', 'specimen_returned_2023',
  'books_finalized_2021', 'books_finalized_2022', 'books_finalized_2023',
  'dist_2024_distributed', 'dist_2024_returned', 'dist_2024_net',
]);
const TEXTAREA_FIELDS = new Set(['school_name_address', 'principal_name_mobile', 'discussion_2024', 'remark']);
const MONTH_FIELDS = new Set(['specimen_give_month', 'book_delivery_month']);
const RADIO_FIELDS = new Set(['gift_given']);

export default function SchoolModule({ setStatus }) {
  const [listType, setListType] = useState('MASTER');
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const saveTimers = useRef({});

  const load = useCallback(async (lt) => {
    setLoading(true);
    try {
      const data = await api(`/schools?list_type=${lt}`);
      setSchools(data);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      setLoading(false);
    }
  }, [setStatus]);

  useEffect(() => { load(listType); setPage(1); }, [listType, load]);
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
    }
  }

  function addBlankSchool() {
    const tempId = `new-${Date.now()}`;
    const blank = { id: tempId, list_type: listType };
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
    window.location.href = `${API_BASE}/api/export/school-list?list_type=${listType}`;
  }

  return (
    <>
      <div className="module-title">School Master List</div>

      <section className="controls">
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
          {RADIO_FIELDS.has(field) ? (
            <div className="radio-group">
              {['Y', 'N'].map(opt => (
                <label key={opt} className="radio-label">
                  <input
                    type="radio"
                    name={`${field}-${school.id}`}
                    checked={school[field] === opt}
                    onChange={() => handleChange(field, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
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