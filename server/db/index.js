const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const DB_PATH = path.join(__dirname, 'data.json');

const defaultData = {
  regions: [],       // { id, name, state }
  areas: [],          // { id, region_id, code, label }
  agents: [],          // { id, name, area_id, active }
  book_types: [],       // { id, category, code, name_english, set_size, sort_order }
  challans: [],          // { id, agent_id, year, s_no, challan_date, challan_no, total_books, items: [{book_type_id, quantity}] }
  returns: [],             // { id, agent_id, year, s_no, return_date, challan_no, books_qty, remark }
  schools: [],              // { id, agent_id, list_type, school_code, school_name_address, ... } — see routes/schools.js for full field list
  order_rows: [],             // { id, agent_id, cycle_start_year, s_no, school_party_name, party_type, new_school_flag, remark }
  order_row_years: [],         // { id, order_row_id, year, elig, given, returned, balance, order_amt, order_ret_amt, balance_amt, defaulter, order_cut }
  parties: [],                  // { id, agent_id, order_no, party_name, amt_received, amt_return }
  _seq: { regions: 0, areas: 0, agents: 0, book_types: 0, challans: 0, returns: 0, schools: 0, order_rows: 0, order_row_years: 0, parties: 0 },
};

const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, defaultData);

function nextId(collection) {
  db.data._seq[collection] = (db.data._seq[collection] || 0) + 1;
  return db.data._seq[collection];
}

async function init() {
  await db.read();
  db.data ||= structuredClone(defaultData);
  // Defensive backfill: if an existing data.json predates a newer field, add it
  // instead of crashing. Keeps old data intact while picking up schema additions.
  for (const key of Object.keys(defaultData)) {
    if (key === '_seq') continue;
    db.data[key] ||= [];
  }
  db.data._seq ||= {};
  for (const key of Object.keys(defaultData._seq)) {
    db.data._seq[key] ||= 0;
  }
  // Backfill: existing regions created before the state field existed default to MP
  // (all seeded/real agents so far are Madhya Pradesh based).
  for (const region of db.data.regions) {
    region.state ||= 'MP';  
  }

    for (const p of db.data.parties) {
    p.year ||= new Date().getFullYear();
  }

  // Seed book types once
  if (db.data.book_types.length === 0) {
    const rows = [
      { category: 'नवबोध सेट', code: 'TYPE_A', name_english: 'Type A (Complete Set)', set_size: 210, sort_order: 1 },
      { category: 'नवबोध सेट', code: 'TYPE_C', name_english: 'Type C (Task Book)', set_size: 14, sort_order: 2 },
      { category: 'नवबोध सेट', code: 'ECO_TASK', name_english: 'Eco. Task Copy', set_size: 14, sort_order: 3 },
      { category: 'नवबोध सेट', code: 'AL', name_english: 'AL', set_size: 25, sort_order: 4 },
      { category: 'नवबोध सेट', code: 'ALL_IN_ONE', name_english: 'All In One Term Book E/m.', set_size: 8, sort_order: 5 },
      { category: 'ज्ञानबोध सेट', code: 'GYAN_BODH', name_english: 'Gyan Bodh', set_size: 164, sort_order: 6 },
      { category: 'ज्ञानबोध सेट', code: 'SKILL_BOOK', name_english: 'Skill Book', set_size: 27, sort_order: 7 },
      { category: 'ज्ञानबोध सेट', code: 'PRACTICE_BOOK', name_english: 'Practice Book', set_size: 23, sort_order: 8 },
      { category: 'ज्ञानबोध सेट', code: 'WORK_BOOK', name_english: 'Work Book', set_size: 23, sort_order: 9 },
      { category: 'ज्ञानबोध सेट', code: 'ART_CRAFT', name_english: 'Art & Craft', set_size: 5, sort_order: 10 },
      { category: 'ज्ञानबोध सेट', code: 'PLAY_GROUP_A', name_english: 'Play Group - A', set_size: 8, sort_order: 11 },
      { category: 'ज्ञानबोध सेट', code: 'PLAY_GROUP_B', name_english: 'Play Group - B', set_size: 8, sort_order: 12 },
      { category: 'अन्य', code: 'SPECIAL_SET', name_english: 'Special Set', set_size: null, sort_order: 13 },
      { category: 'अन्य', code: 'LOOSE_BOOK', name_english: 'Loose Book', set_size: null, sort_order: 14 },
    ];
    for (const row of rows) {
      db.data.book_types.push({ id: nextId('book_types'), ...row });
    }
    console.log('Seeded book_types');
  }

  // Seed the real MP + CG agent/area structure once (156 agents total).
  // Each row in agents-seed.json is one Area with a unique Area Code (e.g. M1, C1)
  // and the one agent who covers it, extracted from the official CG-MP Agent/Area
  // Code sheet.
  if (db.data.agents.length === 0) {
    const seedAgents = require('./agents-seed.json');
    for (const rec of seedAgents) {
      const region = { id: nextId('regions'), name: rec.area_label, state: rec.state };
      db.data.regions.push(region);
      const area = { id: nextId('areas'), region_id: region.id, code: rec.area_code, label: rec.area_label };
      db.data.areas.push(area);
      db.data.agents.push({ id: nextId('agents'), name: rec.agent_name, area_id: area.id, active: 1 });
    }
    console.log(`Seeded ${seedAgents.length} real agents (MP + CG)`);
  }

  // Seed schools once from the real extracted data (3 lists: MASTER, MASTER_NEW, CBSE).
  // These all came from Ankit Kumar Jain's (Bhopal - A / M1) workbook, so they're linked
  // to his agent record. Other agents will show 0 schools until their data is added.
  if (db.data.schools.length === 0) {
    const seedSchools = require('./schools-seed.json');
    const owningAgent = db.data.agents.find(a => a.name === 'Ankit Kumar Jain');
    for (const rec of seedSchools) {
      db.data.schools.push({ id: nextId('schools'), agent_id: owningAgent?.id || null, ...rec });
    }
    console.log(`Seeded ${seedSchools.length} schools (linked to ${owningAgent?.name || 'no agent found'})`);
  }

  // Seed 3-year order/specimen detail once, from the real extracted data (Sanjay Gautam, cycle 2024-26)
  if (db.data.order_rows.length === 0) {
    const seedOrders = require('./order-details-seed.json');
    const sanjay = db.data.agents.find(a => a.name === 'Sanjay Gautam');
    if (sanjay) {
      for (const rec of seedOrders) {
        const { years, ...rowFields } = rec;
        const orderRow = {
          id: nextId('order_rows'),
          agent_id: sanjay.id,
          cycle_start_year: 2024,
          ...rowFields,
        };
        db.data.order_rows.push(orderRow);
        for (const [year, yearData] of Object.entries(years || {})) {
          db.data.order_row_years.push({
            id: nextId('order_row_years'),
            order_row_id: orderRow.id,
            year: Number(year),
            ...yearData,
          });
        }
      }
      console.log(`Seeded ${seedOrders.length} order detail rows (cycle 2024-26, Sanjay Gautam)`);
    }
  }

  await db.write();
}

module.exports = { db, init, nextId };