import { useRef, useEffect, useCallback } from 'react';
import { api } from './api';

export default function Grid({ bookTypes, rows, setRows, agentId, year, setStatus }) {
  const navbodh = bookTypes.filter(b => b.category === 'नवबोध सेट');
  const gyanbodh = bookTypes.filter(b => b.category === 'ज्ञानबोध सेट');
  const special = bookTypes.find(b => b.code === 'SPECIAL_SET');
  const loose = bookTypes.find(b => b.code === 'LOOSE_BOOK');
  const orderedTypes = [...navbodh, ...gyanbodh];

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

  const colCount = 3 + orderedTypes.length + 2 + 1 + 4; // s_no,date,challan_no + types + special+loose + total + 4 return fields

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
        // wait a tick for the new row to render
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
      const items = bookTypes.map(bt => ({
        book_type_id: bt.id,
        quantity: Number(getVal(`item_${bt.id}`)) || 0,
      }));
      const hasAnyData = challan_date || challan_no || total_books || items.some(i => i.quantity);
      if (!hasAnyData) return;
      if (!challan_date || !challan_no) return;

      const payload = {
        agent_id: agentId, year,
        s_no: s_no ? Number(s_no) : null, challan_date, challan_no,
        total_books: total_books ? Number(total_books) : items.reduce((s, i) => s + i.quantity, 0),
        items,
      };

      let newChallan;
      if (row.challan?.id) {
        await api(`/challans/${row.challan.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        newChallan = { ...row.challan, ...payload };
      } else {
        const { id } = await api('/challans', { method: 'POST', body: JSON.stringify(payload) });
        newChallan = { id, ...payload };
      }
      newChallan.items = items.map(i => ({ ...i, ...bookTypes.find(b => b.id === i.book_type_id) }));

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

  // Maps a (section, field) pair to its column index in the row, for keyboard nav / ref lookup
  function fieldColIndex(section, field) {
    if (section === 'challan') {
      if (field === 's_no') return 0;
      if (field === 'challan_date') return 1;
      if (field === 'challan_no') return 2;
      if (field.startsWith('item_')) {
        const btId = Number(field.replace('item_', ''));
        const idx = bookTypes.findIndex(b => b.id === btId);
        // map to orderedTypes/special/loose position
        const bt = bookTypes.find(b => b.id === btId);
        if (bt.code === 'SPECIAL_SET') return 3 + orderedTypes.length;
        if (bt.code === 'LOOSE_BOOK') return 3 + orderedTypes.length + 1;
        const oIdx = orderedTypes.findIndex(o => o.id === btId);
        return 3 + oIdx;
      }
      if (field === 'total_books') return 3 + orderedTypes.length + 2;
    } else if (section === 'ret') {
      const base = 3 + orderedTypes.length + 3;
      if (field === 'return_date') return base;
      if (field === 'return_challan_no') return base + 1;
      if (field === 'return_books_qty') return base + 2;
      if (field === 'remark') return base + 3;
    }
    return -1;
  }

  // ---------- Totals ----------
  const typeSums = {};
  for (const bt of orderedTypes) typeSums[bt.id] = 0;
  let specialSum = 0, looseSum = 0, totalBooks = 0, totalReturn = 0;
  rows.forEach(row => {
    totalBooks += Number(row.challan?.total_books) || 0;
    totalReturn += Number(row.ret?.books_qty) || 0;
    for (const bt of orderedTypes) {
      const q = row.challan?.items?.find(it => it.book_type_id === bt.id)?.quantity;
      typeSums[bt.id] += Number(q) || 0;
    }
    if (special) specialSum += Number(row.challan?.items?.find(it => it.book_type_id === special.id)?.quantity) || 0;
    if (loose) looseSum += Number(row.challan?.items?.find(it => it.book_type_id === loose.id)?.quantity) || 0;
  });

  return (
    <div id="sheetWrap">
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr className="group-row">
              <th colSpan={3}>जावक</th>
              <th colSpan={navbodh.length}>नवबोध सेट</th>
              <th colSpan={gyanbodh.length}>ज्ञानबोध सेट</th>
              <th colSpan={3}></th>
              <th colSpan={4} className="section-divider">आवक/वापसी</th>
            </tr>
            <tr>
              <th>S.N.</th><th>Date</th><th>Challan No.</th>
              {orderedTypes.map(bt => (
                <th key={bt.id} title={bt.set_size ? `${bt.set_size} Books/Set` : ''}>
                  {bt.name_english}{bt.set_size ? <><br /><small>({bt.set_size} Books)</small></> : null}
                </th>
              ))}
              <th>Special Set</th>
              <th>Loose Book</th>
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
                orderedTypes={orderedTypes}
                special={special}
                loose={loose}
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
              {orderedTypes.map(bt => <td key={bt.id}>{typeSums[bt.id] || ''}</td>)}
              <td>{specialSum || ''}</td>
              <td>{looseSum || ''}</td>
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

function Row({ row, rowIndex, orderedTypes, special, loose, setInputRef, handleKeyDown, queueSave, onDelete }) {
  let col = 0;

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

  const cells = [];
  cells.push(numInput(row.challan?.s_no ?? rowIndex + 1, 'challan', col++));
  cells.push(dateInput(row.challan?.challan_date ?? '', 'challan', col++));
  cells.push(textInput(row.challan?.challan_no ?? '', 'challan', col++));

  for (const bt of orderedTypes) {
    const q = row.challan?.items?.find(it => it.book_type_id === bt.id)?.quantity ?? '';
    cells.push(numInput(q, 'challan', col++));
  }
  if (special) {
    const q = row.challan?.items?.find(it => it.book_type_id === special.id)?.quantity ?? '';
    cells.push(numInput(q, 'challan', col++));
  }
  if (loose) {
    const q = row.challan?.items?.find(it => it.book_type_id === loose.id)?.quantity ?? '';
    cells.push(numInput(q, 'challan', col++));
  }
  cells.push(numInput(row.challan?.total_books ?? '', 'challan', col++));

  cells.push(dateInput(row.ret?.return_date ?? '', 'ret', col++, 'section-divider'));
  cells.push(textInput(row.ret?.challan_no ?? '', 'ret', col++));
  cells.push(numInput(row.ret?.books_qty ?? '', 'ret', col++));
  cells.push(textInput(row.ret?.remark ?? '', 'ret', col++, '', 'text-left'));

  cells.push(
    <td key="delete" className="delete-col">
      <button type="button" className="delete-row-btn" title="Delete row" onClick={onDelete}>✕</button>
    </td>
  );

  return <tr>{cells}</tr>;
}