const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const DB_PATH = path.join(__dirname, 'data.json');

const defaultData = {
  regions: [],       // { id, name }
  areas: [],          // { id, region_id, code, label }
  agents: [],          // { id, name, area_id, active }
  book_types: [],       // { id, category, code, name_english, set_size, sort_order }
  challans: [],          // { id, agent_id, year, s_no, challan_date, challan_no, total_books, items: [{book_type_id, quantity}] }
  returns: [],             // { id, agent_id, year, s_no, return_date, challan_no, books_qty, remark }
  _seq: { regions: 0, areas: 0, agents: 0, book_types: 0, challans: 0, returns: 0 },
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

  // Seed sample regions/areas/agents once
  if (db.data.agents.length === 0) {
    const jblId = nextId('regions');
    db.data.regions.push({ id: jblId, name: 'Jabalpur' });
    const jblAId = nextId('areas');
    db.data.areas.push({ id: jblAId, region_id: jblId, code: 'A', label: 'Jabalpur - A' });
    db.data.agents.push({ id: nextId('agents'), name: 'Sanjay Gautam', area_id: jblAId, active: 1 });

    const bplId = nextId('regions');
    db.data.regions.push({ id: bplId, name: 'Bhopal' });
    const bplAId = nextId('areas');
    db.data.areas.push({ id: bplAId, region_id: bplId, code: 'A', label: 'Bhopal - A' });
    db.data.agents.push({ id: nextId('agents'), name: 'Ankit Jain', area_id: bplAId, active: 1 });

    console.log('Seeded sample regions/areas/agents');
  }

  await db.write();
}

module.exports = { db, init, nextId };
