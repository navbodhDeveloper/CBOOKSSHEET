const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db, nextId } = require('../db');

function cellToValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(rt => rt.text).join('');
    if (v.text !== undefined) return v.text;
    if (v.result !== undefined) return v.result; // formula result
    return '';
  }
  return v;
}

// Same column order as the export template (server/routes/export-schools.js).
// null = computed column (Total Spec. Distribute / NET SPE / Net Sale), skipped on import since it's derived.
const IMPORT_COLUMNS = [
  'school_code', 'school_name_address', 'principal_name_mobile', 'grade', 'medium', 'board',
  'specimen_give_month', 'book_delivery_month',
  'specimen_given_2021', 'specimen_given_ayogya_2021', null, 'specimen_returned_2021', null,
  'specimen_given_2022', 'specimen_given_ayogya_2022', null, 'specimen_returned_2022', null,
  'specimen_given_2023', 'specimen_given_ayogya_2023', null, 'specimen_returned_2023', null,
  'sale_details_2021', 'sale_return_2021', null,
  'sale_details_2022', 'sale_return_2022', null,
  'sale_details_2023', 'sale_return_2023', null,
  'visit_1', 'visit_2', 'visit_3',
  'supplying_party', 'discussion_2023', 'discussion_2024', 'remark',
];

// All editable fields
const FIELDS = [
  'agent_id',
  'school_code', 'school_name_address', 'principal_name_mobile',
  'grade', 'medium', 'board',
  'specimen_give_month', 'book_delivery_month',
  'specimen_given_2021', 'specimen_given_ayogya_2021', 'specimen_returned_2021',
  'specimen_given_2022', 'specimen_given_ayogya_2022', 'specimen_returned_2022',
  'specimen_given_2023', 'specimen_given_ayogya_2023', 'specimen_returned_2023',
  'sale_details_2021', 'sale_return_2021',
  'sale_details_2022', 'sale_return_2022',
  'sale_details_2023', 'sale_return_2023',
  'visit_1', 'visit_2', 'visit_3',
  'supplying_party', 'discussion_2023', 'discussion_2024', 'remark',
];

function pickFields(body) {
  const out = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

// Same School Code + School Name/Address already exists anywhere in this list
// (Master/New/CBSE), regardless of which agent owns it.
function findDuplicate(list_type, school_code, school_name_address, excludeId) {
  const code = (school_code || '').trim().toLowerCase();
  const name = (school_name_address || '').trim().toLowerCase();
  if (!code && !name) return null;
  return db.data.schools.find(s =>
    s.id !== excludeId &&
    s.list_type === list_type &&
    (s.school_code || '').trim().toLowerCase() === code &&
    (s.school_name_address || '').trim().toLowerCase() === name
  );
}

// GET /api/schools?list_type=MASTER&search=abc&agent_id=1
router.get('/', (req, res) => {
  const { list_type, search, agent_id } = req.query;
  let rows = db.data.schools;
  if (list_type) rows = rows.filter(s => s.list_type === list_type);
  if (agent_id) rows = rows.filter(s => String(s.agent_id) === String(agent_id));
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
  const { list_type, school_code, school_name_address } = req.body;
  if (!list_type) return res.status(400).json({ error: 'list_type is required' });

  const dup = findDuplicate(list_type, school_code, school_name_address, null);
  if (dup) return res.status(409).json({ error: `Duplicate: a school with this exact School Code and Name already exists in this list (row #${db.data.schools.indexOf(dup) + 1}).` });

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

  const list_type = req.body.list_type || school.list_type;
  const school_code = req.body.school_code !== undefined ? req.body.school_code : school.school_code;
  const school_name_address = req.body.school_name_address !== undefined ? req.body.school_name_address : school.school_name_address;

  const dup = findDuplicate(list_type, school_code, school_name_address, id);
  if (dup) return res.status(409).json({ error: `Duplicate: a school with this exact School Code and Name already exists in this list (row #${db.data.schools.indexOf(dup) + 1}).` });

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

// POST /api/schools/import  { list_type, agent_id, fileBase64 }
router.post('/import', async (req, res) => {
  const { list_type, agent_id, fileBase64 } = req.body;
  if (!list_type) return res.status(400).json({ error: 'list_type is required' });
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required — select an area/agent first' });
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' });

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'No worksheet found in file' });

    let imported = 0;
    let skipped = 0;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < 4) return; // skip title/list/header rows
      const name = cellToValue(row.getCell(3).value); // col 3 = School Name / Address
      if (!name) return;

      const code = cellToValue(row.getCell(2).value);
      if (findDuplicate(list_type, code, name, null)) { skipped++; return; }

      const rec = { id: nextId('schools'), agent_id: Number(agent_id), list_type };
      IMPORT_COLUMNS.forEach((field, idx) => {
        if (!field) return;
        rec[field] = cellToValue(row.getCell(idx + 2).value); // +2: col1=S.N., col2=first data field
      });
      db.data.schools.push(rec);
      imported++;
    });

    await db.write(); 
    res.json({ imported, skipped });
  } catch (err) {
    res.status(400).json({ error: 'Could not read file: ' + err.message });
  }
});

// POST /api/schools/dedupe?list_type=MASTER
// Removes: (1) rows with no School Code AND no School Name/Address — empty filler
// rows, not real data; (2) duplicate School Code + Name pairs, keeping the first.
router.post('/dedupe', async (req, res) => {
  const { list_type } = req.body;
  if (!list_type) return res.status(400).json({ error: 'list_type is required' });

  const seen = new Map();
  const toRemove = [];
  for (const s of db.data.schools) {
    if (s.list_type !== list_type) continue;
    const code = (s.school_code || '').trim().toLowerCase();
    const name = (s.school_name_address || '').trim().toLowerCase();

    if (!code && !name) {
      toRemove.push(s.id);
      continue;
    }

    const key = `${code}|${name}`;
    if (seen.has(key)) {
      toRemove.push(s.id);
    } else {
      seen.set(key, s);
    }
  }

  db.data.schools = db.data.schools.filter(s => !toRemove.includes(s.id));
  await db.write();
  res.json({ removed: toRemove.length });
});

module.exports = router;  