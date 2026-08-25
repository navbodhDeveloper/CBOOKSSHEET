// import { useState, useEffect, useCallback, Fragment } from 'react';
// import { api, API_BASE } from './api';

// export default function OrderDetailModule({ setStatus }) {
//   const [agents, setAgents] = useState([]);
//   const [states, setStates] = useState(['MP', 'CG']);
//   const [selectedState, setSelectedState] = useState('MP');
//   const [agentSearch, setAgentSearch] = useState('');
//   const [cycleStartYear, setCycleStartYear] = useState(new Date().getFullYear());
//   const [selectedAgentId, setSelectedAgentId] = useState(null);
//   const [selectedCycle, setSelectedCycle] = useState(null);
//   const [rows, setRows] = useState([]);
//   const [summary, setSummary] = useState(null);
//   const [loaded, setLoaded] = useState(false);

//   const loadAgents = useCallback(async () => {
//     const [ag, st] = await Promise.all([api('/agents'), api('/states')]);
//     setAgents(ag);
//     setStates(st.length ? st : ['MP', 'CG']);
//   }, []);

//   useEffect(() => { loadAgents().catch(err => setStatus(err.message, true)); }, [loadAgents, setStatus]);

//   const cycleOptions = [];
//   const currentYear = new Date().getFullYear();
//   for (let y = currentYear - 3; y <= currentYear + 1; y++) cycleOptions.push(y);

//   const agentsInState = agents.filter(a => (a.state || 'MP') === selectedState);

//   function resolveAgentId() {
//     const match = agentsInState.find(a => `${a.name} (${a.area_label})` === agentSearch);
//     return match ? match.id : null;
//   }

//   async function loadSheet() {
//     const agentId = resolveAgentId();
//     if (!agentId) { setStatus('Please select a valid agent from the list', true); return; }
//     setSelectedAgentId(agentId);
//     setSelectedCycle(cycleStartYear);

//     const data = await api(`/order-details?agent_id=${agentId}&cycle_start_year=${cycleStartYear}`);
//     setRows(data.rows.length ? data.rows : [blankRow(cycleStartYear)]);
//     setSummary(data.summary);
//     setLoaded(true);
//     setStatus('Sheet loaded');
//   }

//   function blankRow(cycleStart) {
//     return {
//       rowKey: `new-${Date.now()}-${Math.random()}`,
//       s_no: null, school_party_name: '', party_type: 'SCHOOL', new_school_flag: false, remark: '',
//       years: [],
//     };
//   }

//   function addBlankRow() {
//     setRows(prev => [...prev, blankRow(selectedCycle)]);
//   }

//   async function deleteRow(row, idx) {
//     if (!window.confirm('Delete this row? This cannot be undone.')) return;
//     try {
//       if (row.id) await api(`/order-details/${row.id}`, { method: 'DELETE' });
//       setRows(prev => prev.filter((_, i) => i !== idx));
//       setStatus('Row deleted');
//     } catch (err) {
//       setStatus(err.message, true);
//     }
//   }

//   async function saveRow(row, idx) {
//     const years = {};
//     for (const y of row.years) {
//       years[y.year] = {
//         ...y,
//         balance: (Number(y.given) || 0) - (Number(y.returned) || 0),
//         balance_amt: (Number(y.order_amt) || 0) - (Number(y.order_ret_amt) || 0),
//       };
//     }
//     const payload = {
//       agent_id: selectedAgentId, cycle_start_year: selectedCycle,
//       s_no: row.s_no, school_party_name: row.school_party_name, party_type: row.party_type,
//       new_school_flag: row.new_school_flag, remark: row.remark,
//       years,
//     };
//     try {
//       let saved;
//       if (row.id) {
//         saved = await api(`/order-details/${row.id}`, { method: 'PUT', body: JSON.stringify(payload) });
//       } else {
//         saved = await api('/order-details', { method: 'POST', body: JSON.stringify(payload) });
//       }
//       setRows(prev => prev.map((r, i) => (i === idx ? { ...saved, rowKey: r.rowKey } : r)));
//       setStatus('Saved');
//       // refresh summary
//       const data = await api(`/order-details?agent_id=${selectedAgentId}&cycle_start_year=${selectedCycle}`);
//       setSummary(data.summary);
//     } catch (err) {
//       setStatus(err.message, true);
//     }
//   }

//   function updateRowField(idx, field, value) {
//     setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
//   }

//   function updateYearField(idx, year, field, value) {
//     setRows(prev => prev.map((r, i) => {
//       if (i !== idx) return r;
//       const years = [...r.years];
//       let yEntry = years.find(y => y.year === year);
//       if (!yEntry) {
//         yEntry = { year, elig: '', given: '', returned: '', balance: '', order_amt: '', order_ret_amt: '', balance_amt: '', defaulter: false, order_cut: false };
//         years.push(yEntry);
//       }
//       const updatedYears = years.map(y => (y.year === year ? { ...yEntry, [field]: value } : y));
//       return { ...r, years: updatedYears };
//     }));
//   }

//   // Checkboxes don't reliably fire onBlur right after a click, so they save
//   // immediately here using a freshly-built row rather than waiting on state to flush.
//   function toggleYearFlag(idx, year, field, checked) {
//     setRows(prev => {
//       const next = [...prev];
//       const r = { ...next[idx] };
//       const years = [...r.years];
//       let yEntry = years.find(y => y.year === year);
//       if (!yEntry) {
//         yEntry = { year, elig: '', given: '', returned: '', balance: '', order_amt: '', order_ret_amt: '', balance_amt: '', defaulter: false, order_cut: false };
//         years.push(yEntry);
//       }
//       r.years = years.map(y => (y.year === year ? { ...yEntry, [field]: checked } : y));
//       next[idx] = r;
//       saveRow(r, idx);
//       return next;
//     });
//   }

//   function toggleRowFlag(idx, field, checked) {
//     setRows(prev => {
//       const next = [...prev];
//       const r = { ...next[idx], [field]: checked };
//       next[idx] = r;
//       saveRow(r, idx);
//       return next;
//     });
//   }

//   function doExport() {
//     if (!selectedAgentId || !selectedCycle) return;
//     window.location.href = `${API_BASE}/api/export/order-details?agent_id=${selectedAgentId}&cycle_start_year=${selectedCycle}`;
//   }

//   const years = selectedCycle ? [selectedCycle, selectedCycle + 1, selectedCycle + 2] : [];

//   return (
//     <>
//       <div className="module-title">CHILDREN BOOK SPEC. DISTRIBUTE &amp; ORDER DETAIL</div>

//       <section className="controls">
//         <div className="field">
//           <label htmlFor="odStateSelect">State</label>
//           <select
//             id="odStateSelect"
//             value={selectedState}
//             onChange={(e) => { setSelectedState(e.target.value); setAgentSearch(''); }}
//           >
//             {states.map(s => <option key={s} value={s}>{s}</option>)}
//           </select>
//         </div>
//         <div className="field">
//           <label htmlFor="odAgentSearch">Agent Name &amp; Area</label>
//           <input
//             id="odAgentSearch"
//             list="odAgentList"
//             placeholder="Type to search agent..."
//             autoComplete="off"
//             value={agentSearch}
//             onChange={(e) => setAgentSearch(e.target.value)}
//           />
//           <datalist id="odAgentList">
//             {agentsInState.map(a => <option key={a.id} value={`${a.name} (${a.area_label})`} />)}
//           </datalist>
//         </div>
//         <div className="field">
//           <label htmlFor="cycleSelect">Cycle Start Year</label>
//           <select id="cycleSelect" value={cycleStartYear} onChange={(e) => setCycleStartYear(Number(e.target.value))}>
//             {cycleOptions.map(y => <option key={y} value={y}>{y} - {y + 1} - {y + 2}</option>)}
//           </select>
//         </div>
//         <button onClick={() => loadSheet().catch(err => setStatus(err.message, true))}>Load Sheet</button>
//         <button className="secondary" disabled={!loaded} onClick={doExport}>⬇ Export to Excel</button>
//       </section>

//       {loaded && (
//         <div id="sheetWrap">
//           <div className="table-scroll">
//             <table className="grid order-grid">
//               <thead>
//                 <tr className="group-row">
//                   <th colSpan={2}></th>
//                   {years.map(y => <th key={y} colSpan={9}>{y}</th>)}
//                   <th colSpan={2}></th>
//                 </tr>
//                 <tr>
//                   <th>S.N.</th>
//                   <th>School/Party Name</th>
//                   {years.map(y => (
//                     <Fragment key={y}>
//                       <th>योग्य/अयोग्य</th>
//                       <th>बांटा</th>
//                       <th>वापसी</th>
//                       <th>शेष</th>
//                       <th>आर्डर विवरण</th>
//                       <th>आर्डर वापसी</th>
//                       <th>शेष राशि</th>
//                       <th>Defaulter</th>
//                       <th>Order-Cut</th>
//                     </Fragment>
//                   ))}
//                   <th>Type</th>
//                   <th>New</th>
//                   <th>Remark</th>
//                   <th></th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.map((row, idx) => (
//                   <OrderRow
//                     key={row.rowKey || row.id}
//                     row={row}
//                     idx={idx}
//                     years={years}
//                     updateRowField={updateRowField}
//                     updateYearField={updateYearField}
//                     toggleYearFlag={toggleYearFlag}
//                     toggleRowFlag={toggleRowFlag}
//                     onSave={() => saveRow(row, idx)}
//                     onDelete={() => deleteRow(row, idx)}
//                   />
//                 ))}
//               </tbody>
//             </table>
//           </div>
//           <div className="row-actions">
//             <button onClick={addBlankRow}>+ Add Row</button>
//           </div>

//           {summary && <SummaryTables summary={summary} years={years} />}
//         </div>
//       )}
//     </>
//   );
// }

// function OrderRow({ row, idx, years, updateRowField, updateYearField, toggleYearFlag, toggleRowFlag, onSave, onDelete }) {
//   function yearVal(year, field) {
//     const y = row.years.find(y => y.year === year);
//     return y ? (y[field] ?? '') : '';
//   }
//   function numField(year, field) {
//     return (
//       <input
//         type="text" inputMode="numeric"
//         value={yearVal(year, field)}
//         onChange={(e) => updateYearField(idx, year, field, e.target.value.replace(/[^0-9]/g, ''))}
//         onBlur={onSave}
//       />
//     );
//   }

//   return (
//     <tr>
//       <td>
//         <input type="text" inputMode="numeric" value={row.s_no ?? ''}
//           onChange={(e) => updateRowField(idx, 's_no', e.target.value.replace(/[^0-9]/g, ''))} onBlur={onSave} />
//       </td>
//       <td className="text-left">
//         <input type="text" value={row.school_party_name || ''}
//           onChange={(e) => updateRowField(idx, 'school_party_name', e.target.value)} onBlur={onSave} />
//       </td>
//       {years.map(y => (
//         <Fragment key={y}>
//           <td>
//             <select value={yearVal(y, 'elig')} onChange={(e) => updateYearField(idx, y, 'elig', e.target.value)} onBlur={onSave}>
//               <option value=""></option>
//               <option value="Y">Y</option>
//               <option value="A">A</option>
//             </select>
//           </td>
//           <td>{numField(y, 'given')}</td>
//           <td>{numField(y, 'returned')}</td>
//           <td><span className="computed-cell">{(Number(yearVal(y, 'given')) || 0) - (Number(yearVal(y, 'returned')) || 0)}</span></td>
//           <td>{numField(y, 'order_amt')}</td>
//           <td>{numField(y, 'order_ret_amt')}</td>
//           <td><span className="computed-cell">{(Number(yearVal(y, 'order_amt')) || 0) - (Number(yearVal(y, 'order_ret_amt')) || 0)}</span></td>
//           <td>
//             <input type="checkbox" checked={!!row.years.find(yy => yy.year === y)?.defaulter}
//               onChange={(e) => toggleYearFlag(idx, y, 'defaulter', e.target.checked)} />
//           </td>
//           <td>
//             <input type="checkbox" checked={!!row.years.find(yy => yy.year === y)?.order_cut}
//               onChange={(e) => toggleYearFlag(idx, y, 'order_cut', e.target.checked)} />
//           </td>
//         </Fragment>
//       ))}
//       <td>
//         <select value={row.party_type} onChange={(e) => updateRowField(idx, 'party_type', e.target.value)} onBlur={onSave}>
//           <option value="SCHOOL">School</option>
//           <option value="PARTY">Party</option>
//         </select>
//       </td>
//       <td>
//         <input type="checkbox" checked={!!row.new_school_flag} title="New School"
//           onChange={(e) => toggleRowFlag(idx, 'new_school_flag', e.target.checked)} />
//       </td>
//       <td className="text-left">
//         <input type="text" value={row.remark || ''}
//           onChange={(e) => updateRowField(idx, 'remark', e.target.value)} onBlur={onSave} />
//       </td>
//       <td className="delete-col">
//         <button type="button" className="delete-row-btn" title="Delete row" onClick={onDelete}>✕</button>
//       </td>
//     </tr>
//   );
// }

// function SummaryTables({ summary, years }) {
//   const { netTotals, averages, schoolPartyTotals, schoolCounts } = summary;
//   return (
//     <div className="summary-tables">
//       <h3>NET TOTAL</h3>
//       <table className="grid summary-grid">
//         <thead>
//           <tr>
//             <th>Year</th><th>बांटा</th><th>वापसी</th><th>शेष</th>
//             <th>आर्डर विवरण</th><th>आर्डर वापसी</th><th>शेष राशि</th><th>Average Amount</th>
//           </tr>
//         </thead>
//         <tbody>
//           {years.map(y => (
//             <tr key={y}>
//               <td>{y}</td>
//               <td>{netTotals[y]?.given || 0}</td>
//               <td>{netTotals[y]?.returned || 0}</td>
//               <td>{netTotals[y]?.balance || 0}</td>
//               <td>{netTotals[y]?.order_amt || 0}</td>
//               <td>{netTotals[y]?.order_ret_amt || 0}</td>
//               <td>{netTotals[y]?.balance_amt || 0}</td>
//               <td>{averages[y] || 0}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <h3>School vs Party Order Totals</h3>
//       <table className="grid summary-grid">
//         <thead>
//           <tr>
//             <th>Year</th><th>Total Order (School)</th><th>Total Order (Party)</th>
//             <th>Return Order (School)</th><th>Return Order (Party)</th><th>Net Amt</th>
//           </tr>
//         </thead>
//         <tbody>
//           {years.map(y => (
//             <tr key={y}>
//               <td>{y}</td>
//               <td>{schoolPartyTotals[y]?.total_order_school || 0}</td>
//               <td>{schoolPartyTotals[y]?.total_order_party || 0}</td>
//               <td>{schoolPartyTotals[y]?.return_order_school || 0}</td>
//               <td>{schoolPartyTotals[y]?.return_order_party || 0}</td>
//               <td>{schoolPartyTotals[y]?.net_amt || 0}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <h3>School Order Counts</h3>
//       <table className="grid summary-grid">
//         <thead>
//           <tr>
//             <th>Year</th><th>Total Orders (School)</th><th>Old School Orders</th><th>New School Orders</th>
//             <th>Defaulter Schools</th><th>Order-Cut Schools</th>
//           </tr>
//         </thead>
//         <tbody>
//           {years.map(y => (
//             <tr key={y}>
//               <td>{y}</td>
//               <td>{schoolCounts[y]?.total_orders || 0}</td>
//               <td>{schoolCounts[y]?.old_school_orders || 0}</td>
//               <td>{schoolCounts[y]?.new_school_orders || 0}</td>
//               <td>{schoolCounts[y]?.defaulter_count || 0}</td>
//               <td>{schoolCounts[y]?.order_cut_count || 0}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//       <p className="summary-note">
//         "New" is auto-detected: a school counts as new in a year if it has an order amount that year but none in a prior year within this loaded cycle.
//         Defaulter/Order-Cut counts come from the flags you set per row per year — check the row's year cell (via the row's edit controls) to mark them.
//       </p>
//     </div>
//   );
// }