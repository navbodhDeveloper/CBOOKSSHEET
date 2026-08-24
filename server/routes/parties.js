const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

const FIELDS = ['agent_id', 'year', 'order_no', 'party_name', 'amt_received', 'amt_return', 'remark'];

function pickFields(body) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

// GET /api/parties?agent_id=1&cycle_start_year=2026
// Returns rows within [cycle_start_year, +1, +2] for that agent, plus a NET TOTAL summary per year.
router.get('/', (req, res) => {
  const { agent_id, cycle_start_year } = req.query;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });

  let rows = db.data.parties.filter(p => String(p.agent_id) === String(agent_id));

  let years = [];
  if (cycle_start_year) {
    const start = Number(cycle_start_year);
    years = [start, start + 1, start + 2];
    rows = rows.filter(p => years.includes(Number(p.year)));
  }
  rows = rows.sort((a, b) => (a.year || 0) - (b.year || 0) || a.id - b.id);

  const netTotals = {};
  for (const y of years) {
    const yearRows = rows.filter(p => Number(p.year) === y);
    const received = yearRows.reduce((s, p) => s + (Number(p.amt_received) || 0), 0);
    const ret = yearRows.reduce((s, p) => s + (Number(p.amt_return) || 0), 0);
    netTotals[y] = { received, return: ret, remaining: received - ret };
  }

  res.json({ rows, summary: { years, netTotals } });
});

// POST /api/parties
router.post('/', async (req, res) => {
  const { agent_id } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });
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