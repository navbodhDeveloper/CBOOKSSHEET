import { useRef, useCallback, useEffect } from 'react';
import { api } from './api';

// Column layout: S.N. is auto-computed from row position (not a stored/editable field —
// see Row below), then Date(1) Challan No.(2) Total Books(3) | Return Date(4) Return
// Challan No.(5) Return Qty(6) Remark(7). Column indices for inputs/refs/keyboard-nav
// stay numbered this way (starting at 1) to avoid renumbering everything else.
const COL_COUNT = 8;

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
    const sorted = [...rows].sort((a, b) => parseDate(a.challan?.challan_date) - parseDate(b.challan?.challan_date));
    setRows(sorted);
    try {
      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i];
        if (row.challan?.id) await api(`/challans/${row.challan.id}`, { method: 'PUT', body: JSON.stringify({ ...row.challan, s_no: i + 1 }) });
        if (row.ret?.id) await api(`/challans/returns/${row.ret.id}`, { method: 'PUT', body: JSON.stringify({ ...row.ret, s_no: i + 1 }) });
      }
      setStatus('Sorted by date');
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [rows, setRows, setStatus]);

  // Checks the DOM directly (not just saved row state) since inputs here are
  // uncontrolled — the user may have typed something but not yet blurred/saved it.
  function lastRowHasData(rowIndex) {
    for (let c = 1; c <= 7; c++) {
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

  const deleteRow = useCallback(async (rowIndex) => {
    const row = rows[rowIndex];
    const hasData = row.challan || row.ret;
    if (hasData && !window.confirm('Delete this row? This cannot be undone.')) return;

    try {
      if (row.challan?.id) await api(`/challans/${row.challan.id}`, { method: 'DELETE' });
      if (row.ret?.id) await api(`/challans/returns/${row.ret.id}`, { method: 'DELETE' });
      setRows(prev => prev.filter((_, i) => i !== rowIndex));
      setStatus('Row deleted');
    } catch (err) {
      setStatus(err.message, true);
    }
  }, [rows, setRows, setStatus]);

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
      if (field === 'challan_no') return 2;
      if (field === 'total_books') return 3;
    } else if (section === 'ret') {
      if (field === 'return_date') return 4;
      if (field === 'return_challan_no') return 5;
      if (field === 'return_books_qty') return 6;
      if (field === 'remark') return 7;
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
      const challan_no = getVal('challan_no');
      const total_books = getVal('total_books');
      const hasAnyData = challan_date || challan_no || total_books;
      if (!hasAnyData) return;
      if (!challan_date || !challan_no) return;

      // Block duplicate Challan No. — check against every OTHER row currently on the
      // sheet (case-insensitive, trimmed), reading the LIVE ref rather than a
      // snapshot, so a save that just completed a moment ago (e.g. during fast/paste
      // entry across many rows) is always accounted for here.
      const normalized = challan_no.trim().toLowerCase();
      const dupRowIndex = rowsRef.current.findIndex((r, i) => i !== rowIndex && (r.challan?.challan_no || '').trim().toLowerCase() === normalized);
      if (dupRowIndex !== -1) {
        const el = refsMap.current.get(`${rowIndex}-2`);
        if (el) el.value = row.challan?.challan_no || '';
        setStatus(`Duplicate Challan No. "${challan_no}" — not saved`, true);
        window.alert(`Challan No. "${challan_no}" is already used in row ${dupRowIndex + 1}. Please use a different Challan No. — this entry was not saved.`);
        return;
      }

      // S.N. is always the row's position — never typed, never stored as a separate
      // editable value, so it can never go out of sequence or duplicate.
      const payload = {
        agent_id: agentId, year,
        s_no: rowIndex + 1, challan_date, challan_no,
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
              <th colSpan={4}>जावक</th>
              <th colSpan={4} className="section-divider">आवक/वापसी</th>
            </tr>
            <tr>
              <th>S.N.</th>
              <th>Date</th>
              <th>Challan No.</th>
              <th>किताबों की संख्या</th>
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
                onDelete={() => deleteRow(rIdx)}
                isDuplicate={duplicateFlags[rIdx]}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>TOTAL:-</td>
              <td>{totalBooks || ''}</td>
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
      </div>
    </div>
  );
}

function Row({ row, rowIndex, setInputRef, handleKeyDown, queueSave, onDelete, isDuplicate }) {
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
    textInput(row.challan?.challan_no ?? '', 'challan', 2),
    numInput(row.challan?.total_books ?? '', 'challan', 3),
    dateInput(row.ret?.return_date ?? '', 'ret', 4, 'section-divider'),
    textInput(row.ret?.challan_no ?? '', 'ret', 5),
    numInput(row.ret?.books_qty ?? '', 'ret', 6),
    textInput(row.ret?.remark ?? '', 'ret', 7, '', 'text-left'),
    <td key="delete" className="delete-col">
      <button type="button" className="delete-row-btn" title="Delete row" onClick={onDelete}>✕</button>
    </td>,
  ];

  return <tr className={isDuplicate ? 'duplicate-row' : ''}>{cells}</tr>;
}