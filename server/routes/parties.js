const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

const FIELDS = ['agent_id', 'order_no', 'party_name', 'amt_received', 'amt_return', 'remark'];

function pickFields(body) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

// GET /api/parties?agent_id=1
router.get('/', (req, res) => {
  const { agent_id } = req.query;
  let rows = db.data.parties;
  if (agent_id) rows = rows.filter(p => String(p.agent_id) === String(agent_id));
  res.json(rows.sort((a, b) => a.id - b.id));
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