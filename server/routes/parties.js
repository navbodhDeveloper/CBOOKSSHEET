const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

// Base fields every party row has, regardless of cycle.
const BASE_FIELDS = ['agent_id', 'cycle_start_year', 's_no', 'party_name', 'remark'];
// Year-specific fields look like sale_details_2026 / sale_return_2026 — matched dynamically
// so the same route code works for any 3-year cycle without hardcoding years.
const YEAR_FIELD_RE = /^sale_(details|return)_\d{4}$/;

function pickFields(body) {
  const out = {};
  for (const f of BASE_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  for (const key of Object.keys(body)) {
    if (YEAR_FIELD_RE.test(key)) out[key] = body[key];
  }
  return out;
}

function yearsForCycle(cycleStartYear) {
  const start = Number(cycleStartYear);
  return [start, start + 1, start + 2];
}

// GET /api/parties?agent_id=1&cycle_start_year=2026
// Returns every party row for that agent within the given 3-year cycle, plus a
// NET TOTAL summary per year (Sale Details / Sale Return / Net Sale).
router.get('/', (req, res) => {
  const { agent_id, cycle_start_year } = req.query;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });

  let rows = db.data.parties.filter(p => String(p.agent_id) === String(agent_id));

  let years = [];
  if (cycle_start_year) {
    years = yearsForCycle(cycle_start_year);
    rows = rows.filter(p => Number(p.cycle_start_year) === Number(cycle_start_year));
  }
  rows = rows.sort((a, b) => (Number(a.s_no) || 0) - (Number(b.s_no) || 0) || a.id - b.id);

  const netTotals = {};
  for (const y of years) {
    const detailsKey = `sale_details_${y}`;
    const returnKey = `sale_return_${y}`;
    const details = rows.reduce((s, p) => s + (Number(p[detailsKey]) || 0), 0);
    const ret = rows.reduce((s, p) => s + (Number(p[returnKey]) || 0), 0);
    netTotals[y] = { details, return: ret, net: details - ret };
  }

  res.json({ rows, summary: { years, netTotals } });
});

// POST /api/parties
router.post('/', async (req, res) => {
  const { agent_id, cycle_start_year } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });
  if (!cycle_start_year) return res.status(400).json({ error: 'cycle_start_year is required' });
  const party = { id: nextId('parties'), ...pickFields(req.body) };
  db.data.parties.push(party);
  await db.write();
  res.status(201).json(party);
});

// PUT /api/parties/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const party = db.data.parties.find(p => p.id === id);
  if (!party) return res.status(404).json({ error: 'not found' });
  Object.assign(party, pickFields(req.body));
  await db.write();
  res.json(party);
});

// DELETE /api/parties/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.parties = db.data.parties.filter(p => p.id !== id);
  await db.write();
  res.json({ ok: true });
});

module.exports = router;