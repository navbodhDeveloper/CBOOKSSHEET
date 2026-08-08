const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

// All editable fields, in the exact original column order
const FIELDS = [
  'school_code', 'school_name_address', 'principal_name_mobile',
  'grade', 'medium', 'board',
  'specimen_give_month', 'book_delivery_month',
  'specimen_given_2021', 'specimen_given_2022', 'specimen_given_2023',
  'specimen_returned_2021', 'specimen_returned_2022', 'specimen_returned_2023',
  'books_finalized_2021', 'books_finalized_2022', 'books_finalized_2023',
  'gift_given',
  'visit_1', 'visit_2', 'visit_3',
  'dist_2024_distributed', 'dist_2024_returned', 'dist_2024_net',
  'supplying_party', 'discussion_2024', 'remark',
];

function pickFields(body) {
  const out = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

// GET /api/schools?list_type=MASTER&search=abc
router.get('/', (req, res) => {
  const { list_type, search } = req.query;
  let rows = db.data.schools;
  if (list_type) rows = rows.filter(s => s.list_type === list_type);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(s =>
      (s.school_name_address || '').toLowerCase().includes(q) ||
      (s.school_code || '').toLowerCase().includes(q)
    );
  }
  res.json(rows);
});

// GET /api/schools/:id
router.get('/:id', (req, res) => {
  const school = db.data.schools.find(s => s.id === Number(req.params.id));
  if (!school) return res.status(404).json({ error: 'not found' });
  res.json(school);
});

// POST /api/schools  { list_type, ...fields }
router.post('/', async (req, res) => {
  const { list_type } = req.body;
  if (!list_type) return res.status(400).json({ error: 'list_type is required' });

  const school = { id: nextId('schools'), list_type, ...pickFields(req.body) };
  db.data.schools.push(school);
  await db.write();
  res.status(201).json(school);
});

// PUT /api/schools/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const school = db.data.schools.find(s => s.id === id);
  if (!school) return res.status(404).json({ error: 'not found' });

  Object.assign(school, pickFields(req.body));
  await db.write();
  res.json(school);
});

// DELETE /api/schools/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.schools = db.data.schools.filter(s => s.id !== id);
  await db.write();
  res.json({ ok: true });
});

module.exports = router;