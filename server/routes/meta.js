const express = require('express');
const router = express.Router();
const { db, nextId } = require('../db');

router.get('/regions', (req, res) => {
  res.json([...db.data.regions].sort((a, b) => a.name.localeCompare(b.name)));
});

router.get('/areas', (req, res) => {
  const { region_id, state } = req.query;
  let areas = db.data.areas;
  if (region_id) areas = areas.filter(a => String(a.region_id) === String(region_id));
  let withRegion = areas.map(a => {
    const region = db.data.regions.find(r => r.id === a.region_id);
    return { ...a, region_name: region?.name, state: region?.state || 'MP' };
  });
  if (state) withRegion = withRegion.filter(a => a.state === state);
  withRegion.sort((a, b) => a.label.localeCompare(b.label));
  res.json(withRegion);
});

router.get('/agents', (req, res) => {
  const rows = db.data.agents
    .filter(a => a.active)
    .map(a => {
      const area = db.data.areas.find(ar => ar.id === a.area_id);
      const region = area ? db.data.regions.find(r => r.id === area.region_id) : null;
      return {
        id: a.id,
        name: a.name,
        active: a.active,
        area_id: area?.id,
        area_code: area?.code,
        area_label: area?.label,
        region_name: region?.name,
        state: region?.state || 'MP',
      };
    })
    .sort((a, b) => (a.region_name || '').localeCompare(b.region_name || '') || a.name.localeCompare(b.name));
  res.json(rows);
});

// GET /api/states — distinct states currently in use, for the state filter dropdown
router.get('/states', (req, res) => {
  const states = new Set(db.data.regions.map(r => r.state || 'MP'));
  states.add('MP');
  states.add('CG');
  res.json([...states].sort());
});

// Shared logic: find-or-create a region+area from (state, region_name, area_code)
function resolveArea({ state, region_name, area_code }) {
  let region = db.data.regions.find(r => r.name === region_name);
  if (!region) {
    region = { id: nextId('regions'), name: region_name, state: state || 'MP' };
    db.data.regions.push(region);
  } else if (state && !region.state) {
    region.state = state;
  } else if (state) {
    region.state = state; // allow moving a region's state on edit
  }
  let area = db.data.areas.find(a => a.region_id === region.id && a.code === area_code);
  if (!area) {
    area = { id: nextId('areas'), region_id: region.id, code: area_code, label: `${region_name} - ${area_code}` };
    db.data.areas.push(area);
  }
  return area;
}

router.post('/agents', async (req, res) => {
  const { name, area_id, region_name, area_code, state } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  let finalAreaId = area_id;
  if (!finalAreaId && region_name && area_code) {
    finalAreaId = resolveArea({ state, region_name, area_code }).id;
  }
  if (!finalAreaId) return res.status(400).json({ error: 'area_id or (region_name + area_code) is required' });

  const agent = { id: nextId('agents'), name, area_id: finalAreaId, active: 1 };
  db.data.agents.push(agent);
  await db.write();
  res.status(201).json({ id: agent.id });
});

// PUT /api/agents/:id  { name, state, region_name, area_code }
// Used when an agent leaves and is replaced, or their name/area/state needs correcting.
router.put('/agents/:id', async (req, res) => {
  const id = Number(req.params.id);
  const agent = db.data.agents.find(a => a.id === id);
  if (!agent) return res.status(404).json({ error: 'agent not found' });

  const { name, state, region_name, area_code } = req.body;
  if (name) agent.name = name;
  if (region_name && area_code) {
    agent.area_id = resolveArea({ state, region_name, area_code }).id;
  }

  await db.write();
  res.json({ id: agent.id });
});

router.get('/book-types', (req, res) => {
  res.json([...db.data.book_types].sort((a, b) => a.sort_order - b.sort_order));
});

module.exports = router;