const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

const LIST_LABELS = {
  MASTER: 'School Master List',
  MASTER_NEW: 'School Master List (NEW)',
  CBSE: 'CBSE',
};

// Fields that get summed into the TOTAL row — same set as client/src/SchoolModule.jsx's
// NUMERIC_FIELDS. Computed columns (Total Spec. Distribute / NET SPE / Net Sale) are
// summed too, via their own `compute` function below — everything else (name, code,
// grade, medium, board, month/date/text fields) is left blank in the TOTAL row, exactly
// matching how the on-screen footer only fills in numeric/computed columns.
const NUMERIC_FIELDS = new Set([
  'specimen_given_2021', 'specimen_given_ayogya_2021', 'specimen_returned_2021',
  'specimen_given_2022', 'specimen_given_ayogya_2022', 'specimen_returned_2022',
  'specimen_given_2023', 'specimen_given_ayogya_2023', 'specimen_returned_2023',
  'sale_details_2021', 'sale_return_2021',
  'sale_details_2022', 'sale_return_2022',
  'sale_details_2023', 'sale_return_2023',
]);

// Formats a yyyy-mm-dd value (from a <input type="date">) as d/mm/yyyy, e.g.
// "2021-08-02" -> "2/08/2021". No computed logic beyond this formatting — the date is
// stored and shown exactly as the user typed it.
function formatDMY(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${parseInt(d, 10)}/${m}/${y}`;
}

// Combines the sheet's one common Sale Date and Return Date into one display string,
// e.g. "2/08/2021 - 18/09/2023". If only one is set, shows just that one.
function dateRangeDisplay(saleDate, returnDate) {
  const s = formatDMY(saleDate);
  const r = formatDMY(returnDate);
  if (s && r) return `${s} - ${r}`;
  return s || r || '';
}

// Server-side mirror of client/src/SchoolModule.jsx's getVisits() — a school's visits
// live in the 'visits' array field, but older records may still only have the legacy
// visit_1/2/3 fields (no date, just a remark string), so those are read as a fallback.
function getVisits(school) {
  if (Array.isArray(school.visits)) return school.visits;
  const legacy = [school.visit_1, school.visit_2, school.visit_3].filter(v => (v || '').toString().trim());
  return legacy.map(v => ({ date: '', remark: String(v) }));
}

// Renders a school's visit list as one multi-line cell, e.g.:
// 1) 2/08/2021 - met principal
// 2) 15/09/2021 - follow-up visit
function formatVisitsForExport(school) {
  const visits = getVisits(school);
  if (!visits.length) return '';
  return visits
    .map((v, i) => {
      const d = formatDMY(v.date);
      const label = d && v.remark ? `${d} - ${v.remark}` : (d || v.remark || '');
      return `${i + 1}) ${label}`;
    })
    .join('\n');
}

// [field, header label, width, compute?] — computed columns use a string ID (matching
// the same keys used in client/src/SchoolModule.jsx's COMPUTED object) instead of a
// real DB field, so the `fields` query param (column picker selections from the UI)
// can filter them the same way as ordinary columns.
const COLUMNS = [
  ['school_code', 'School Code', 14],
  ['school_name_address', 'School Name / Address', 40],
  ['principal_name_mobile', 'Principal Name / \nMobile No.', 26],
  ['grade', 'Grade', 8],
  ['medium', 'Medium', 8],
  ['board', 'Board', 8],
  ['specimen_give_month', 'Specimen Give Month', 12],
  ['book_delivery_month', 'Book Delivery Month', 12],

  ['specimen_given_2021', '2021 Specimen Given Yogya', 10],
  ['specimen_given_ayogya_2021', '2021 Specimen Given \nAyogya', 10],
  ['TOTAL_DISTRIBUTE_2021', '2021 \nTotal Spec. Distribute\n', 10, s => (Number(s.specimen_given_2021) || 0) + (Number(s.specimen_given_ayogya_2021) || 0)],
  ['specimen_returned_2021', '2021 Specimen Returned ', 10],
  ['NET_SPE_2021', '2021 \nNET SPE', 10, s => ((Number(s.specimen_given_2021) || 0) + (Number(s.specimen_given_ayogya_2021) || 0)) - (Number(s.specimen_returned_2021) || 0)],

  ['specimen_given_2022', '2022 Specimen Given Yogya', 10],
  ['specimen_given_ayogya_2022', '2022 Specimen Given \nAyogya', 10],
  ['TOTAL_DISTRIBUTE_2022', '2022 \nTotal Spec. Distribute\n', 10, s => (Number(s.specimen_given_2022) || 0) + (Number(s.specimen_given_ayogya_2022) || 0)],
  ['specimen_returned_2022', '2022 Specimen Returned ', 10],
  ['NET_SPE_2022', '2022 \nNET SPE', 10, s => ((Number(s.specimen_given_2022) || 0) + (Number(s.specimen_given_ayogya_2022) || 0)) - (Number(s.specimen_returned_2022) || 0)],

  ['specimen_given_2023', '2023 Specimen Given Yogya', 10],
  ['specimen_given_ayogya_2023', '2023 Specimen Given \nAyogya', 10],
  ['TOTAL_DISTRIBUTE_2023', '2023 \nTotal Spec. Distribute\n', 10, s => (Number(s.specimen_given_2023) || 0) + (Number(s.specimen_given_ayogya_2023) || 0)],
  ['specimen_returned_2023', '2023 Specimen Returned ', 10],
  ['NET_SPE_2023', '2023 \nNET SPE', 10, s => ((Number(s.specimen_given_2023) || 0) + (Number(s.specimen_given_ayogya_2023) || 0)) - (Number(s.specimen_returned_2023) || 0)],

  ['sale_details_2021', '2021\nSale Details', 10],
  ['sale_return_2021', '2021 \nSale Return', 10],
  ['NET_SALE_2021', '2021\nNet \nSale', 10, s => (Number(s.sale_details_2021) || 0) - (Number(s.sale_return_2021) || 0)],

  ['sale_details_2022', '2022\nSale Details', 10],
  ['sale_return_2022', '2022 \nSale Return', 10],
  ['NET_SALE_2022', '2022\nNet \nSale', 10, s => (Number(s.sale_details_2022) || 0) - (Number(s.sale_return_2022) || 0)],

  ['sale_details_2023', '2023\nSale Details', 10],
  ['sale_return_2023', '2023 \nSale Return', 10],
  ['NET_SALE_2023', '2023\nNet \nSale', 10, s => (Number(s.sale_details_2023) || 0) - (Number(s.sale_return_2023) || 0)],

  ['visits', 'School Visit Date', 24, s => formatVisitsForExport(s)],

  ['supplying_party', 'Supplying Party', 16],
  ['discussion_2023', 'Discussion 2023', 24],
  ['discussion_2024', 'Discussion 2024', 24],
  ['remark', 'Remark', 20],
];

router.get('/school-list', async (req, res) => {
  const { list_type, agent_id, fields, board, ids } = req.query;
  if (!list_type || !LIST_LABELS[list_type]) {
    return res.status(400).json({ error: 'valid list_type is required (MASTER, MASTER_NEW, or CBSE)' });
  }

  // Optional column filter driven by the "Columns" checkbox picker in the UI.
  // No `fields` param (or an empty one) = full export, same as before this feature existed.
  let activeColumns = COLUMNS;
  if (fields) {
    const wanted = new Set(fields.split(',').map(f => f.trim()).filter(Boolean));
    activeColumns = COLUMNS.filter(([field]) => wanted.has(field));
  }
  const isPartial = activeColumns.length < COLUMNS.length;

  let schools = db.data.schools.filter(s => s.list_type === list_type);
  if (agent_id) schools = schools.filter(s => String(s.agent_id) === String(agent_id));

  // Optional exact-row filter driven by the row checkboxes in the UI (like the Columns
  // picker, but for rows). When present, this takes priority over the Board filter below
  // — picking exact rows is more specific than picking a board.
  if (ids) {
    const wantedIds = new Set(ids.split(',').map(i => i.trim()).filter(Boolean));
    schools = schools.filter(s => wantedIds.has(String(s.id)));
  } else if (board) {
    // Optional Board filter driven by the checkbox list shown when "Export to Excel" is
    // clicked (e.g. only MP, or only CG + CBSE). No `board` param = every board, same as
    // before this feature existed. Matched case-insensitively/trimmed against whatever
    // free-text value was typed into the Board column.
    const wantedBoards = new Set(board.split(',').map(b => b.trim().toLowerCase()).filter(Boolean));
    schools = schools.filter(s => wantedBoards.has((s.board || '').trim().toLowerCase()));
  }

  schools = schools.sort((a, b) => a.id - b.id);

  // One common Sale Date / Return Date for the whole sheet (list type + agent) — not
  // per school row. Only meaningful when exporting for a single agent, since the
  // date is stored per (list_type, agent) — left blank if exporting across all agents.
  const meta = agent_id
    ? (db.data.school_sheet_meta || []).find(m => m.list_type === list_type && String(m.agent_id) === String(agent_id))
    : null;
  const dateRangeLine = meta ? dateRangeDisplay(meta.sale_date, meta.return_date) : '';

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(LIST_LABELS[list_type]);

  const lastCol = activeColumns.length + 1;

  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'Children Book School Master List';
  titleCell.font = { bold: true, size: 13 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = `List: ${LIST_LABELS[list_type]}${isPartial ? ' (partial columns — view/print only, not for re-import)' : ''}`;
  sheet.getCell(2, 1).font = { bold: true };

  // One common Date line for the whole sheet (Sale Date - Return Date), e.g.
  // "Date :- 2/08/2021 - 18/09/2023" — always present (even if blank) so the row
  // position stays consistent whether or not dates have been entered yet.
  sheet.mergeCells(3, 1, 3, lastCol);
  sheet.getCell(3, 1).value = `Date :- ${dateRangeLine}`;
  sheet.getCell(3, 1).font = { bold: true };
  sheet.getCell(3, 1).alignment = { horizontal: 'center' };

  // Header shifted down by 1 row (row 4) to make room for the Date line above.
  const headerRow = 4;
  sheet.getCell(headerRow, 1).value = 'S.N.';
  sheet.getCell(headerRow, 1).font = { bold: true };
  activeColumns.forEach(([field, label], idx) => {
    const cell = sheet.getCell(headerRow, idx + 2);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sheet.getRow(headerRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  schools.forEach((school, i) => {
    const r = headerRow + 1 + i;
    sheet.getCell(r, 1).value = i + 1;
    activeColumns.forEach(([field, , , compute], idx) => {
      const val = compute ? compute(school) : school[field];
      if (val !== null && val !== undefined && val !== '') {
        const cell = sheet.getCell(r, idx + 2);
        cell.value = val;
        // The visits column can hold several numbered lines (one per visit) — wrap
        // and top-align so multi-line entries are readable instead of overflowing
        // into one squashed line.
        if (field === 'visits') {
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
        }
      }
    });
  });

  const lastDataRow = headerRow + schools.length;

  // TOTAL row — sums the same numeric/computed columns as the on-screen footer in
  // SchoolModule.jsx (specimen given/returned, sale details/return, and the computed
  // Total Spec. Distribute / NET SPE / Net Sale columns). Text/date/select columns are
  // left blank, same as the footer shows an empty cell for those.
  const totalRow = lastDataRow + 1;
  sheet.getCell(totalRow, 1).value = 'TOTAL:-';
  activeColumns.forEach(([field, , , compute], idx) => {
    // 'visits' has a compute function too, but it returns text (the formatted visit
    // list), not a number — skip it here so the TOTAL row leaves it blank instead of
    // showing a meaningless 0.
    if (field !== 'visits' && (compute || NUMERIC_FIELDS.has(field))) {
      const total = schools.reduce((sum, s) => {
        const v = compute ? compute(s) : Number(s[field]) || 0;
        return sum + (Number(v) || 0);
      }, 0);
      sheet.getCell(totalRow, idx + 2).value = total;
    }
  });
  sheet.getRow(totalRow).font = { bold: true };
  sheet.getRow(totalRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  sheet.getColumn(1).width = 6;
  activeColumns.forEach(([, , width], idx) => {
    sheet.getColumn(idx + 2).width = width;
  });

  for (let row = 1; row <= totalRow; row++) {
    for (let col = 1; col <= lastCol; col++) {
      sheet.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  const filename = `${LIST_LABELS[list_type].replace(/[^\w]+/g, '_')}${isPartial ? '_partial' : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;