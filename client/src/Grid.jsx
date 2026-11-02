import { useRef, useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Column layout: S.N. is auto-computed from row position (not a stored/editable field —
// see Row below), then Date(1) Type(2) Challan No.(3) Total Books(4) | Return Date(5)
// Return Challan No.(6) Return Qty(7) Remark(8). Column indices for inputs/refs/keyboard-
// nav stay numbered this way (starting at 1) to avoid renumbering everything else.
const COL_COUNT = 9;

// Book-type dropdown options, grouped exactly like the reference chart (नवबोध सेट /
// ज्ञानबोध सेट), plus the two standalone sets. Stored as plain text on the challan
// record (`book_type`) — this is just a pick-list, not a separate lookup table.
const BOOK_TYPE_GROUPS = [
  {
    label: 'नवबोध सेट',
    options: ['Type A (Complete Set)', 'Type C (Task Book)', 'Eco. Task Copy', 'AL', 'All In One Term Book E/m.'],
  },
  {
    label: 'ज्ञानबोध सेट',
    options: ['Gyan Bodh', 'Skill Book', 'Practice Book', 'Work Book', 'Art & Craft', 'Play Group - A', 'Play Group - B'],
  },
];
const BOOK_TYPE_STANDALONE = ['Special Set', 'Loose Book'];
const BASE_BOOK_TYPES = [...BOOK_TYPE_GROUPS.flatMap(g => g.options), ...BOOK_TYPE_STANDALONE];
const ADD_CUSTOM_VALUE = '__add_custom__';
const CUSTOM_TYPES_KEY = 'customBookTypes';

// A challan's Type can now be MORE THAN ONE (tick several checkboxes). It is stored as one
// plain text value on `book_type`, joined with ", " — e.g. "Type A (Complete Set), Skill Book".
function parseTypes(v) {
  return (v || '').toString().split(',').map(t => t.trim()).filter(Boolean);
}

// The Type cell: shows the ticked types; clicking opens a checkbox list (grouped like the
// reference chart, + Custom types, + "Add custom type…"). Saves when the list is closed.
// The trigger <button> doubles as the cell's ref — saveSection reads its `.value`, which is
// kept equal to the joined selection (same way the other cells expose their value).
function TypeMultiSelect({ value, extraTypes, addCustomType, innerRef, onKeyDown, onCommit }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [sel, setSel] = useState(() => parseTypes(value));
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const changed = useRef(false);
  const selRef = useRef(sel);
  selRef.current = sel;

  const allTypes = [...BASE_BOOK_TYPES, ...extraTypes];
  const order = (list) => [...list].sort((a, b) => {
    const ia = allTypes.indexOf(a), ib = allTypes.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  const joined = order(sel).join(', ');

  const setRefs = (el) => {
    btnRef.current = el;
    innerRef(el);
    if (el) el.value = joined;
  };

  function openPopup() {
    const r = btnRef.current.getBoundingClientRect();
    const maxH = Math.min(window.innerHeight * 0.6, 420);
    const top = r.bottom + 2 + maxH > window.innerHeight ? Math.max(8, window.innerHeight - maxH - 8) : r.bottom + 2;
    setPos({ top, left: Math.min(r.left, window.innerWidth - 270), maxH });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    if (changed.current) {
      changed.current = false;
      if (btnRef.current) btnRef.current.value = order(selRef.current).join(', ');
      onCommit();
    }
  }
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      closeRef.current();
    };
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) closeRef.current(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  function toggle(name) {
    changed.current = true;
    setSel(prev => (prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]));
  }
  function clearAll() {
    changed.current = true;
    setSel([]);
  }
  function handleAddCustom() {
    const name = window.prompt('Enter the new custom Type name:');
    const finalName = name ? addCustomType(name) : null;
    if (!finalName) return;
    changed.current = true;
    setSel(prev => (prev.includes(finalName) ? prev : [...prev, finalName]));
  }

  // Checkboxes pinned to their natural size (same reason as the other dialogs: a global
  // input { width:100% } style would otherwise stretch them into bars).
  const boxStyle = { width: 16, height: 16, minWidth: 16, flex: '0 0 auto', margin: 0 };
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', fontSize: 13, cursor: 'pointer', textAlign: 'left' };
  const groupStyle = { fontWeight: 'bold', fontSize: 12, padding: '6px 10px 2px', color: '#1f4e78', textAlign: 'left' };
  const renderOption = (name) => (
    <label key={name} style={rowStyle}>
      <input type="checkbox" checked={sel.includes(name)} onChange={() => toggle(name)} style={boxStyle} />
      <span>{name}</span>
    </label>
  );

  return (
    <>
      <button
        type="button"
        ref={setRefs}
        title={joined || 'Select type(s)'}
        onClick={() => (open ? close() : openPopup())}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); openPopup(); }
          else onKeyDown(e);
        }}
        style={{
          // The global `button` style is white text on a blue background — override it all so
          // the cell looks like the other plain cells (dark text, no fill, no border).
          width: '100%', background: 'transparent', color: '#222', border: 'none', borderRadius: 0, boxShadow: 'none',
          margin: 0, font: 'inherit', fontSize: 13, fontWeight: 'normal', cursor: 'pointer', minHeight: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '2px 4px',
        }}
      >
        <span style={{ flex: '1 1 auto', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {joined || '\u00a0'}
        </span>
        <span style={{ flex: '0 0 auto', fontSize: 10 }}>▾</span>
      </button>
      {open && pos && (
        <div
          ref={popRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: 260, maxHeight: pos.maxH, overflowY: 'auto',
            background: '#fff', border: '1px solid #999', borderRadius: 4, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #ddd', position: 'sticky', top: 0, background: '#fff' }}>
            <button type="button" className="secondary" onClick={clearAll}>Clear</button>
            <button type="button" onClick={close}>Done</button>
          </div>
          {BOOK_TYPE_GROUPS.map(g => (
            <div key={g.label}>
              <div style={groupStyle}>{g.label}</div>
              {g.options.map(renderOption)}
            </div>
          ))}
          <div style={groupStyle}>Other</div>
          {BOOK_TYPE_STANDALONE.map(renderOption)}
          {extraTypes.length > 0 && (
            <>
              <div style={groupStyle}>Custom</div>
              {extraTypes.map(renderOption)}
            </>
          )}
          <div style={{ padding: 8, borderTop: '1px solid #ddd' }}>
            <button type="button" className="secondary" onClick={handleAddCustom} style={{ width: '100%' }}>➕ Add custom type…</button>
          </div>
        </div>
      )}
    </>
  );
}

// A row is flagged as a duplicate if its Challan No. matches another row's. S.N. can no
// longer duplicate since it's always auto-computed from row position — see Row below —
// so it's not part of this check anymore.
function computeDuplicateFlags(rows) {
  const challanNoCounts = new Map();

  rows.forEach(row => {
    const cn = (row.challan?.challan_no || '').trim().toLowerCase();
    if (cn) {
      challanNoCounts.set(cn, (challanNoCounts.get(cn) || 0) + 1);
    }
  });

  return rows.map(row => {
    const cn = (row.challan?.challan_no || '').trim().toLowerCase();
    return cn && challanNoCounts.get(cn) > 1;
  });
}

// Deletes many records one-by-one on the server (10 at a time) using the normal
// single-record DELETE routes, so it works with the backend exactly as it is today.
// Returns how many failed.
async function deleteMany(paths) {
  let failed = 0;
  for (let i = 0; i < paths.length; i += 10) {
    const results = await Promise.allSettled(paths.slice(i, i + 10).map(p => api(p, { method: 'DELETE' })));
    failed += results.filter(r => r.status === 'rejected').length;
  }
  return failed;
}

export default function Grid({ rows, setRows, agentId, year, setStatus }) {
  // refs[rowIndex][colIndex] -> input DOM element
  const refsMap = useRef(new Map());
  const saveQueue = useRef(Promise.resolve());
  // Always holds the CURRENT rows array. saveSection reads from this ref (not the
  // `rows` closure) so the duplicate-Challan-No. check and the existing-record lookup
  // always see saves that just completed a moment earlier — fixes duplicates slipping
  // through during fast/paste-style entry across many rows in quick succession.
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Custom Types the user added via "➕ Add custom type…". Remembered in this browser, and
  // any Type already saved on a challan (even from another device) is shown too.
  const [customTypes, setCustomTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY) || '[]'); } catch { return []; }
  });
  const extraTypes = Array.from(new Set([
    ...customTypes,
    ...rows.flatMap(r => parseTypes(r.challan?.book_type)),
  ])).filter(t => !BASE_BOOK_TYPES.includes(t));

  // Returns the final type name to select (existing match if it's a duplicate), or null.
  function addCustomType(rawName) {
    const name = (rawName || '').replace(/,/g, ' ').trim().replace(/\s+/g, ' ');
    if (!name) return null;
    const existing = [...BASE_BOOK_TYPES, ...extraTypes].find(t => t.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const next = [...customTypes, name];
    setCustomTypes(next);
    try { localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return name;
  }

  const duplicateFlags = computeDuplicateFlags(rows);
  const duplicateCount = duplicateFlags.filter(Boolean).length;

  const setInputRef = (rowIndex, colIndex) => (el) => {
    const key = `${rowIndex}-${colIndex}`;
    if (el) refsMap.current.set(key, el);
    else refsMap.current.delete(key);
  };

  const focusCell = (rowIndex, colIndex) => {
    const el = refsMap.current.get(`${rowIndex}-${colIndex}`);
    if (el) el.focus();
  };

  const sortByDate = useCallback(async () => {
    const parseDate = (d) => {
      if (!d) return Infinity;
      const t = new Date(d).getTime();
      return Number.isNaN(t) ? Infinity : t;
    };

    // जावक and आवक/वापसी rows are only ever zipped together by array position — not by
    // any real relationship (see rows[i] = {challan, ret} in the data model). So each
    // side must be sorted independently, ascending by its own date, and THEN re-zipped
    // by position. Sorting the combined row by जावक date only (the old behavior) left
    // the आवक side in whatever order it happened to ride along in.
    const challans = rows
      .map(r => r.challan)
      .filter(Boolean)
      .sort((a, b) => parseDate(a.challan_date) - parseDate(b.challan_date));

    const returns = rows
      .map(r => r.ret)
      .filter(Boolean)
      .sort((a, b) => parseDate(a.return_date) - parseDate(b.return_date));

    const maxLen = Math.max(challans.length, returns.length);
    const sorted = [];
    for (let i = 0; i < maxLen; i++) {
      sorted.push({
        rowKey: `row-sorted-${i}-${Date.now()}-${Math.random()}`,
        challan: challans[i] ?? null,
        ret: returns[i] ?? null,
      });
    }

    setRows(sorted);
    try {
      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i];
        if (row.challan?.id) await api(`/challans/${row.challan.id}`, { method: 'PUT', body: JSON.stringify({ ...row.challan, s_no: i + 1 }) });
        if (row.ret?.id) await api(`/challans/returns/${row.ret.id}`, { method: 'PUT', body: JSON.stringify({ ...row.ret, s_no: i + 1 }) });
      }
      setStatus('Sorted by date (जावक and आवक/वापसी sorted independently)');
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [rows, setRows, setStatus]);

  // Checks the DOM directly (not just saved row state) since inputs here are
  // uncontrolled — the user may have typed something but not yet blurred/saved it.
  function lastRowHasData(rowIndex) {
    for (let c = 1; c <= 8; c++) {
      const el = refsMap.current.get(`${rowIndex}-${c}`);
      if (el && el.value && el.value.trim() !== '') return true;
    }
    return false;
  }

  const addBlankRow = useCallback(() => {
    if (rows.length > 0) {
      const lastIdx = rows.length - 1;
      const lastRow = rows[lastIdx];
      if (!(lastRow.challan || lastRow.ret) && !lastRowHasData(lastIdx)) {
        setStatus('Please fill in the current row before adding a new one', true);
        return false;
      }
    }
    setRows(prev => [...prev, { rowKey: `row-new-${Date.now()}-${Math.random()}`, challan: null, ret: null }]);
    return true;
  }, [rows, setRows, setStatus]);

  // Delete ONE side of a row — 'challan' (जावक) or 'ret' (आवक/वापसी) — without touching
  // the other. The two sides are independent lists that are only zipped together by
  // position (same as Sort by Date), so the remaining records on the deleted side move
  // up one place to close the gap, exactly like they would after a reload.
  const deleteSide = useCallback(async (rowIndex, side) => {
    const cur = rowsRef.current;
    const row = cur[rowIndex];
    if (!row) return;
    const rec = row[side];

    // Fully empty row (nothing saved on either side): just remove it.
    if (!rec && !row.challan && !row.ret) {
      setRows(prev => prev.filter((_, i) => i !== rowIndex));
      return;
    }
    if (!rec) return;

    const label = side === 'challan' ? 'जावक' : 'आवक/वापसी';
    if (!window.confirm(`Delete the ${label} record in row ${rowIndex + 1}? The other side of this row is NOT deleted. This cannot be undone.`)) return;

    try {
      if (side === 'challan') await api(`/challans/${rec.id}`, { method: 'DELETE' });
      else await api(`/challans/returns/${rec.id}`, { method: 'DELETE' });

      const challans = cur.map(r => r.challan);
      const returns = cur.map(r => r.ret);
      const list = side === 'challan' ? challans : returns;
      list.splice(rowIndex, 1);
      list.push(null);

      let next = cur.map((r, i) => {
        const changed = i >= rowIndex;
        return {
          rowKey: changed ? `row-del-${i}-${Date.now()}-${Math.random()}` : r.rowKey,
          challan: challans[i] ?? null,
          ret: returns[i] ?? null,
        };
      });
      // Drop trailing rows that are now empty on both sides (keep at least one row).
      while (next.length > 1 && !next[next.length - 1].challan && !next[next.length - 1].ret) next.pop();

      rowsRef.current = next;
      setRows(next);

      // Records that moved up get their new position saved as S.N.
      for (let i = rowIndex; i < next.length; i++) {
        const sideRec = next[i][side];
        if (!sideRec) continue;
        const payload = { ...sideRec, s_no: i + 1 };
        if (side === 'challan') await api(`/challans/${sideRec.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        else await api(`/challans/returns/${sideRec.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
      setStatus(`${label} record deleted`);
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [setRows, setStatus]);

  // DELETE ALL: removes every जावक and आवक/वापसी record on this sheet (this agent + year)
  // in one go, after a single warning.
  const deleteAll = useCallback(async () => {
    const cur = rowsRef.current;
    const paths = [];
    cur.forEach(r => {
      if (r.challan?.id) paths.push(`/challans/${r.challan.id}`);
      if (r.ret?.id) paths.push(`/challans/returns/${r.ret.id}`);
    });
    if (!paths.length) { setStatus('Nothing to delete', true); return; }
    if (!window.confirm(`⚠ DELETE ALL?\n\nThis will permanently delete ALL ${paths.length} records (both जावक and आवक/वापसी) on this sheet.\n\nThis cannot be undone.`)) return;
    try {
      setStatus('Deleting all records...');
      const failed = await deleteMany(paths);
      const blank = [{ rowKey: `row-new-${Date.now()}-${Math.random()}`, challan: null, ret: null }];
      rowsRef.current = blank;
      setRows(blank);
      setStatus(failed ? `Deleted with ${failed} failure(s) — reload the sheet to check` : 'All records deleted', !!failed);
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [setRows, setStatus]);

  function handleKeyDown(e, rowIndex, colIndex) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === rows.length - 1) {
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

  function queueSave(rowIndex, section) {
    saveQueue.current = saveQueue.current
      .then(() => saveSection(rowIndex, section))
      .catch(err => setStatus(err.message, true));
  }

  function fieldColIndex(section, field) {
    if (section === 'challan') {
      if (field === 'challan_date') return 1;
      if (field === 'book_type') return 2;
      if (field === 'challan_no') return 3;
      if (field === 'total_books') return 4;
    } else if (section === 'ret') {
      if (field === 'return_date') return 5;
      if (field === 'return_challan_no') return 6;
      if (field === 'return_books_qty') return 7;
      if (field === 'remark') return 8;
    }
    return -1;
  }

  async function saveSection(rowIndex, section) {
    const row = rowsRef.current[rowIndex];
    const getVal = (field) => {
      const idx = fieldColIndex(section, field);
      const el = refsMap.current.get(`${rowIndex}-${idx}`);
      return el ? el.value.trim() : '';
    };

    if (section === 'challan') {
      const challan_date = getVal('challan_date');
      const book_type = getVal('book_type');
      const challan_no = getVal('challan_no');
      const total_books = getVal('total_books');
      const hasAnyData = challan_date || book_type || challan_no || total_books;
      if (!hasAnyData) return;
      if (!challan_date || !challan_no) return;

      // Block duplicate Challan No. — check against every OTHER row currently on the
      // sheet (case-insensitive, trimmed), reading the LIVE ref rather than a
      // snapshot, so a save that just completed a moment ago (e.g. during fast/paste
      // entry across many rows) is always accounted for here.
      const normalized = challan_no.trim().toLowerCase();
      const dupRowIndex = rowsRef.current.findIndex((r, i) => i !== rowIndex && (r.challan?.challan_no || '').trim().toLowerCase() === normalized);
      if (dupRowIndex !== -1) {
        const el = refsMap.current.get(`${rowIndex}-3`);
        if (el) el.value = row.challan?.challan_no || '';
        setStatus(`Duplicate Challan No. "${challan_no}" — not saved`, true);
        window.alert(`Challan No. "${challan_no}" is already used in row ${dupRowIndex + 1}. Please use a different Challan No. — this entry was not saved.`);
        return;
      }

      // S.N. is always the row's position — never typed, never stored as a separate
      // editable value, so it can never go out of sequence or duplicate.
      const payload = {
        agent_id: agentId, year,
        s_no: rowIndex + 1, challan_date, book_type, challan_no,
        total_books: total_books ? Number(total_books) : 0,
        items: [],
      };

      let newChallan;
      if (row.challan?.id) {
        await api(`/challans/${row.challan.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        newChallan = { ...row.challan, ...payload };
      } else {
        const { id } = await api('/challans', { method: 'POST', body: JSON.stringify(payload) });
        newChallan = { id, ...payload };
      }

      const next1 = [...rowsRef.current];
      next1[rowIndex] = { ...next1[rowIndex], challan: newChallan };
      rowsRef.current = next1;
      setRows(next1);
    } else if (section === 'ret') {
      const return_date = getVal('return_date');
      const challan_no = getVal('return_challan_no');
      const books_qty = getVal('return_books_qty');
      const remark = getVal('remark');
      const hasAnyData = return_date || challan_no || books_qty || remark;
      if (!hasAnyData) return;

      const payload = {
        agent_id: agentId, year,
        s_no: rowIndex + 1, return_date: return_date || null, challan_no: challan_no || null,
        books_qty: books_qty ? Number(books_qty) : 0, remark: remark || null,
      };

      let newRet;
      if (row.ret?.id) {
        await api(`/challans/returns/${row.ret.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        newRet = { ...row.ret, ...payload };
      } else {
        const { id } = await api('/challans/returns', { method: 'POST', body: JSON.stringify(payload) });
        newRet = { id, ...payload };
      }

      const next2 = [...rowsRef.current];
      next2[rowIndex] = { ...next2[rowIndex], ret: newRet };
      rowsRef.current = next2;
      setRows(next2);
    }
    setStatus('Saved');
  }

  // ---------- Totals ----------
  let totalBooks = 0, totalReturn = 0;
  rows.forEach(row => {
    totalBooks += Number(row.challan?.total_books) || 0;
    totalReturn += Number(row.ret?.books_qty) || 0;
  });

  return (
    <div id="sheetWrap">
      {duplicateCount > 0 && (
        <div style={{ marginBottom: 8, color: '#b00020', fontWeight: 'bold' }}>
          ⚠ {duplicateCount} duplicate row{duplicateCount > 1 ? 's' : ''} highlighted in red — matching Challan No. found
        </div>
      )}
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr className="group-row">
              <th colSpan={6}>जावक</th>
              <th colSpan={4} className="section-divider">आवक/वापसी</th>
            </tr>
            <tr>
              <th>S.N.</th>
              <th>Date</th>
              <th>Type</th>
              <th>Challan No.</th>
              <th>किताबों की संख्या</th>
              <th></th>
              <th className="section-divider">दिनांक</th>
              <th>चालान क्रमांक</th>
              <th>किताबों की संख्या</th>
              <th>रिमार्क</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <Row
                key={row.rowKey ?? rIdx}
                row={row}
                rowIndex={rIdx}
                setInputRef={setInputRef}
                handleKeyDown={handleKeyDown}
                queueSave={queueSave}
                extraTypes={extraTypes}
                addCustomType={addCustomType}
                onDeleteChallan={() => deleteSide(rIdx, 'challan')}
                onDeleteRet={() => deleteSide(rIdx, 'ret')}
                isDuplicate={duplicateFlags[rIdx]}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>TOTAL:-</td>
              <td>{totalBooks || ''}</td>
              <td></td>
              <td className="section-divider"></td>
              <td>TOTAL:-</td>
              <td>{totalReturn || ''}</td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="row-actions">
        <button onClick={() => { if (addBlankRow()) setTimeout(() => focusCell(rows.length, 1), 0); }}>+ Add Row</button>
        <button className="secondary" onClick={sortByDate}>⇅ Sort by Date</button>
        <button className="secondary" style={{ color: '#b00020', borderColor: '#b00020' }} onClick={deleteAll}>🗑 Delete All</button>
      </div>
    </div>
  );
}

function Row({ row, rowIndex, setInputRef, handleKeyDown, queueSave, extraTypes, addCustomType, onDeleteChallan, onDeleteRet, isDuplicate }) {
  const numInput = (defaultValue, section, colIndex, extraClass = '') => {
    const c = colIndex;
    return (
      <td className={extraClass} key={c}>
        <input
          type="text"
          inputMode="numeric"
          defaultValue={defaultValue ?? ''}
          ref={setInputRef(rowIndex, c)}
          onInput={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, c)}
          onBlur={() => queueSave(rowIndex, section)}
        />
      </td>
    );
  };

  // "Type" column — tick one or more types (checkbox list). Stored as plain text on
  // `book_type`, joined with ", ".
  const typeSelect = (defaultValue, section, colIndex, extraClass = '') => {
    const c = colIndex;
    return (
      <td className={extraClass} key={c}>
        <TypeMultiSelect
          value={defaultValue ?? ''}
          extraTypes={extraTypes}
          addCustomType={addCustomType}
          innerRef={setInputRef(rowIndex, c)}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, c)}
          onCommit={() => queueSave(rowIndex, section)}
        />
      </td>
    );
  };

  const textInput = (defaultValue, section, colIndex, placeholder = '', extraClass = '') => {
    const c = colIndex;
    return (
      <td className={extraClass} key={c}>
        <input
          type="text"
          placeholder={placeholder}
          defaultValue={defaultValue ?? ''}
          ref={setInputRef(rowIndex, c)}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, c)}
          onBlur={() => queueSave(rowIndex, section)}
        />
      </td>
    );
  };

  const dateInput = (defaultValue, section, colIndex, extraClass = '') => {
    const c = colIndex;
    return (
      <td className={extraClass} key={c}>
        <input
          type="date"
          defaultValue={defaultValue ?? ''}
          ref={setInputRef(rowIndex, c)}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, c)}
          onBlur={() => queueSave(rowIndex, section)}
        />
      </td>
    );
  };

  const cells = [
    // S.N. is always the row's position on the sheet — plain display, not an input, so
    // it can never be typed differently or end up duplicated/out of sequence.
    <td key="sn">{rowIndex + 1}</td>,
    dateInput(row.challan?.challan_date ?? '', 'challan', 1),
    typeSelect(row.challan?.book_type ?? '', 'challan', 2),
    textInput(row.challan?.challan_no ?? '', 'challan', 3),
    numInput(row.challan?.total_books ?? '', 'challan', 4),
    // Delete ONLY the जावक record of this row.
    <td key="delete-challan" className="delete-col">
      {row.challan && (
        <button type="button" className="delete-row-btn" title="Delete जावक record" onClick={onDeleteChallan}>✕</button>
      )}
    </td>,
    dateInput(row.ret?.return_date ?? '', 'ret', 5, 'section-divider'),
    textInput(row.ret?.challan_no ?? '', 'ret', 6),
    numInput(row.ret?.books_qty ?? '', 'ret', 7),
    textInput(row.ret?.remark ?? '', 'ret', 8, '', 'text-left'),
    // Delete ONLY the आवक/वापसी record (or remove a completely empty row).
    <td key="delete" className="delete-col">
      {(row.ret || !row.challan) && (
        <button type="button" className="delete-row-btn" title="Delete आवक/वापसी record" onClick={onDeleteRet}>✕</button>
      )}
    </td>,
  ];

  return <tr className={isDuplicate ? 'duplicate-row' : ''}>{cells}</tr>;
}  