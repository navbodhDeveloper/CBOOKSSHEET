const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

const YEAR_FIELDS = ['elig', 'given', 'returned', 'balance', 'order_amt', 'order_ret_amt', 'balance_amt', 'defaulter', 'order_cut'];
const ROW_FIELDS = ['s_no', 'school_party_name', 'party_type', 'new_school_flag', 'remark'];

function pickYearFields(body) {
  const out = {};
  for (const f of YEAR_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  return out;
}
function pickRowFields(body) {
  const out = {};
  for (const f of ROW_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

function getYearsForRow(rowId) {
  return db.data.order_row_years.filter(y => y.order_row_id === rowId);
}

// GET /api/order-details?agent_id=1&cycle_start_year=2024
router.get('/', (req, res) => {
  const { agent_id, cycle_start_year } = req.query;
  if (!agent_id || !cycle_start_year) {
    return res.status(400).json({ error: 'agent_id and cycle_start_year are required' });
  }
  const rows = db.data.order_rows
    .filter(r => String(r.agent_id) === String(agent_id) && String(r.cycle_start_year) === String(cycle_start_year))
    .sort((a, b) => (a.s_no || 0) - (b.s_no || 0) || a.id - b.id)
    .map(r => ({ ...r, years: getYearsForRow(r.id) }));

  // ---- Computed summaries ----
  const startYear = Number(cycle_start_year);
  const years = [startYear, startYear + 1, startYear + 2];

  const netTotals = {};
  const averages = {};
  const schoolPartyTotals = {};
  const schoolCounts = {};

  for (const year of years) {
    const yearEntries = rows.map(r => r.years.find(y => y.year === year)).filter(Boolean);

    const sum = (field) => yearEntries.reduce((s, y) => s + (Number(y[field]) || 0), 0);
    netTotals[year] = {
      given: sum('given'), returned: sum('returned'), balance: sum('balance'),
      order_amt: sum('order_amt'), order_ret_amt: sum('order_ret_amt'), balance_amt: sum('balance_amt'),
    };

    const withBalanceAmt = yearEntries.filter(y => Number(y.balance_amt) > 0);
    averages[year] = withBalanceAmt.length
      ? Math.round(withBalanceAmt.reduce((s, y) => s + Number(y.balance_amt), 0) / withBalanceAmt.length)
      : 0;

    const schoolRows = rows.filter(r => r.party_type === 'SCHOOL');
    const partyRows = rows.filter(r => r.party_type === 'PARTY');
    const schoolYearEntries = schoolRows.map(r => r.years.find(y => y.year === year)).filter(Boolean);
    const partyYearEntries = partyRows.map(r => r.years.find(y => y.year === year)).filter(Boolean);
    const sumOf = (arr, field) => arr.reduce((s, y) => s + (Number(y[field]) || 0), 0);
    schoolPartyTotals[year] = {
      total_order_school: sumOf(schoolYearEntries, 'order_amt'),
      total_order_party: sumOf(partyYearEntries, 'order_amt'),
      return_order_school: sumOf(schoolYearEntries, 'order_ret_amt'),
      return_order_party: sumOf(partyYearEntries, 'order_ret_amt'),
      net_amt: netTotals[year].balance_amt,
    };

    // "New" = school row has order_amt in this year but not in any prior year within this cycle
    const priorYears = years.filter(y => y < year);
    let totalOrders = 0, oldSchoolOrders = 0, newSchoolOrders = 0, defaulterCount = 0, orderCutCount = 0;
    for (const r of schoolRows) {
      const entry = r.years.find(y => y.year === year);
      if (entry && Number(entry.order_amt) > 0) {
        totalOrders++;
        const hadPriorOrder = priorYears.some(py => {
          const pe = r.years.find(y => y.year === py);
          return pe && Number(pe.order_amt) > 0;
        });
        if (hadPriorOrder) oldSchoolOrders++; else newSchoolOrders++;
      }
      if (entry && entry.defaulter) defaulterCount++;
      if (entry && entry.order_cut) orderCutCount++;
    }
    schoolCounts[year] = {
      total_orders: totalOrders,
      old_school_orders: oldSchoolOrders,
      new_school_orders: newSchoolOrders,
      defaulter_count: defaulterCount,
      order_cut_count: orderCutCount,
    };
  }

  res.json({ rows, summary: { netTotals, averages, schoolPartyTotals, schoolCounts, years } });
});

// POST /api/order-details  { agent_id, cycle_start_year, ...rowFields, years: {2024: {...}, ...} }
router.post('/', async (req, res) => {
  const { agent_id, cycle_start_year, years } = req.body;
  if (!agent_id || !cycle_start_year) {
    return res.status(400).json({ error: 'agent_id and cycle_start_year are required' });
  }
  const row = {
    id: nextId('order_rows'),
    agent_id: Number(agent_id),
    cycle_start_year: Number(cycle_start_year),
    ...pickRowFields(req.body),
  };
  db.data.order_rows.push(row);

  const createdYears = [];
  for (const [year, yearData] of Object.entries(years || {})) {
    const yr = { id: nextId('order_row_years'), order_row_id: row.id, year: Number(year), ...pickYearFields(yearData) };
    db.data.order_row_years.push(yr);
    createdYears.push(yr);
  }

  await db.write();
  res.status(201).json({ ...row, years: createdYears });
});

// PUT /api/order-details/:id  { ...rowFields, years: {2024: {...}, ...} }
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const row = db.data.order_rows.find(r => r.id === id);
  if (!row) return res.status(404).json({ error: 'not found' });

  Object.assign(row, pickRowFields(req.body));

  const { years } = req.body;
  for (const [year, yearData] of Object.entries(years || {})) {
    let yr = db.data.order_row_years.find(y => y.order_row_id === id && y.year === Number(year));
    if (yr) {
      Object.assign(yr, pickYearFields(yearData));
    } else {
      yr = { id: nextId('order_row_years'), order_row_id: id, year: Number(year), ...pickYearFields(yearData) };
      db.data.order_row_years.push(yr);
    }
  }

  await db.write();
  res.json({ ...row, years: getYearsForRow(id) });
});

// DELETE /api/order-details/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.order_rows = db.data.order_rows.filter(r => r.id !== id);
  db.data.order_row_years = db.data.order_row_years.filter(y => y.order_row_id !== id);
  await db.write();
  res.json({ ok: true });
});

module.exports = router;