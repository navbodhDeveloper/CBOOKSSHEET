const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

function enrichItems(items) {
  return (items || []).map(it => {
    const bt = db.data.book_types.find(b => b.id === it.book_type_id);
    return { ...it, code: bt?.code, name_english: bt?.name_english, category: bt?.category, sort_order: bt?.sort_order };
  });
}

// GET /api/challans?agent_id=1&year=2026
router.get('/', (req, res) => {
  const { agent_id, year } = req.query;
  if (!agent_id || !year) return res.status(400).json({ error: 'agent_id and year are required' });

  const challans = db.data.challans
    .filter(c => String(c.agent_id) === String(agent_id) && String(c.year) === String(year))
    .sort((a, b) => (a.challan_date || '').localeCompare(b.challan_date || '') || (a.s_no || 0) - (b.s_no || 0))
    .map(c => ({ ...c, items: enrichItems(c.items) }));

  const returns = db.data.returns
    .filter(r => String(r.agent_id) === String(agent_id) && String(r.year) === String(year))
    .sort((a, b) => (a.return_date || '').localeCompare(b.return_date || '') || (a.s_no || 0) - (b.s_no || 0));

  const bookTypes = [...db.data.book_types].sort((a, b) => a.sort_order - b.sort_order);
  const totals = {};
  for (const bt of bookTypes) totals[bt.code] = 0;
  let totalBooksSum = 0;
  for (const c of challans) {
    totalBooksSum += Number(c.total_books) || 0;
    for (const item of c.items) totals[item.code] = (totals[item.code] || 0) + (Number(item.quantity) || 0);
  }
  const totalReturnQty = returns.reduce((sum, r) => sum + (Number(r.books_qty) || 0), 0);

  res.json({ challans, returns, totals: { byBookType: totals, totalBooksSum, totalReturnQty } });
});

// POST /api/challans
router.post('/', async (req, res) => {
  const { agent_id, year, s_no, challan_date, challan_no, total_books, items } = req.body;
  if (!agent_id || !year || !challan_date || !challan_no) {
    return res.status(400).json({ error: 'agent_id, year, challan_date, challan_no are required' });
  }
  const challan = {
    id: nextId('challans'),
    agent_id: Number(agent_id), year: Number(year), s_no: s_no ? Number(s_no) : null,
    challan_date, challan_no, total_books: Number(total_books) || 0,
    items: (items || []).filter(i => Number(i.quantity) !== 0).map(i => ({ book_type_id: i.book_type_id, quantity: Number(i.quantity) })),
  };
  db.data.challans.push(challan);
  await db.write();
  res.status(201).json({ id: challan.id });
});

// PUT /api/challans/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { s_no, challan_date, challan_no, total_books, items } = req.body;
  const challan = db.data.challans.find(c => c.id === id);
  if (!challan) return res.status(404).json({ error: 'not found' });

  challan.s_no = s_no ? Number(s_no) : null;
  challan.challan_date = challan_date;
  challan.challan_no = challan_no;
  challan.total_books = Number(total_books) || 0;
  challan.items = (items || []).filter(i => Number(i.quantity) !== 0).map(i => ({ book_type_id: i.book_type_id, quantity: Number(i.quantity) }));

  await db.write();
  res.json({ ok: true });
});

// DELETE /api/challans/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.challans = db.data.challans.filter(c => c.id !== id);
  await db.write();
  res.json({ ok: true });
});

// ---- Returns ----

router.post('/returns', async (req, res) => {
  const { agent_id, year, s_no, return_date, challan_no, books_qty, remark } = req.body;
  if (!agent_id || !year) return res.status(400).json({ error: 'agent_id and year are required' });

  const ret = {
    id: nextId('returns'), agent_id: Number(agent_id), year: Number(year),
    s_no: s_no ? Number(s_no) : null, return_date: return_date || null, challan_no: challan_no || null,
    books_qty: Number(books_qty) || 0, remark: remark || null,
  };
  db.data.returns.push(ret);
  await db.write();
  res.status(201).json({ id: ret.id });
});

router.put('/returns/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { s_no, return_date, challan_no, books_qty, remark } = req.body;
  const ret = db.data.returns.find(r => r.id === id);
  if (!ret) return res.status(404).json({ error: 'not found' });

  ret.s_no = s_no ? Number(s_no) : null;
  ret.return_date = return_date || null;
  ret.challan_no = challan_no || null;
  ret.books_qty = Number(books_qty) || 0;
  ret.remark = remark || null;

  await db.write();
  res.json({ ok: true });
});

router.delete('/returns/:id', async (req, res) => {
  const id = Number(req.params.id);
  db.data.returns = db.data.returns.filter(r => r.id !== id);
  await db.write();
  res.json({ ok: true });
});

module.exports = router;
