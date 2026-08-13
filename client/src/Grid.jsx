import { useRef, useCallback } from 'react';
import { api } from './api';

// Column layout: S.N.(0) Date(1) Challan No.(2) Total Books(3) | Return Date(4) Return Challan No.(5) Return Qty(6) Remark(7)
const COL_COUNT = 8;

export default function Grid({ rows, setRows, agentId, year, setStatus }) {
  // refs[rowIndex][colIndex] -> input DOM element
  const refsMap = useRef(new Map());
  const saveQueue = useRef(Promise.resolve());

  const setInputRef = (rowIndex, colIndex) => (el) => {
    const key = `${rowIndex}-${colIndex}`;
    if (el) refsMap.current.set(key, el);
    else refsMap.current.delete(key);
  };

  const focusCell = (rowIndex, colIndex) => {
    const el = refsMap.current.get(`${rowIndex}-${colIndex}`);
    if (el) el.focus();
  };

  const addBlankRow = useCallback(() => {
    setRows(prev => [...prev, { rowKey: `row-new-${Date.now()}-${Math.random()}`, challan: null, ret: null }]);
  }, [setRows]);

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

  function queueSave(rowIndex, section) {
    saveQueue.current = saveQueue.current
      .then(() => saveSection(rowIndex, section))
      .catch(err => setStatus(err.message, true));
  }

  function fieldColIndex(section, field) {
    if (section === 'challan') {
      if (field === 's_no') return 0;
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
    const row = rows[rowIndex];
    const getVal = (field) => {
      const idx = fieldColIndex(section, field);
      const el = refsMap.current.get(`${rowIndex}-${idx}`);
      return el ? el.value.trim() : '';
    };

    if (section === 'challan') {
      const challan_date = getVal('challan_date');
      const challan_no = getVal('challan_no');
      const s_no = getVal('s_no');
      const total_books = getVal('total_books');
      const hasAnyData = challan_date || challan_no || total_books;
      if (!hasAnyData) return;
      if (!challan_date || !challan_no) return;

      const payload = {
        agent_id: agentId, year,
        s_no: s_no ? Number(s_no) : null, challan_date, challan_no,
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

      setRows(prev => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], challan: newChallan };
        return next;
      });
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

      setRows(prev => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], ret: newRet };
        return next;
      });
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
        <button onClick={() => { addBlankRow(); setTimeout(() => focusCell(rows.length, 0), 0); }}>+ Add Row</button>
      </div>
    </div>
  );
}

function Row({ row, rowIndex, setInputRef, handleKeyDown, queueSave, onDelete }) {
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
    numInput(row.challan?.s_no ?? rowIndex + 1, 'challan', 0),
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

  return <tr>{cells}</tr>;
}