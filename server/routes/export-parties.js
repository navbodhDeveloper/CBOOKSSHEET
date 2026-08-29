const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

function colToLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

// GET /api/export/parties?agent_id=1&cycle_start_year=2026
router.get('/parties', async (req, res) => {
  const { agent_id, cycle_start_year, agent_display_name } = req.query;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });
  if (!cycle_start_year) return res.status(400).json({ error: 'cycle_start_year is required' });

  const agent = db.data.agents.find(a => a.id === Number(agent_id));
  if (!agent) return res.status(404).json({ error: 'agent not found' });
  const area = db.data.areas.find(a => a.id === agent.area_id);
  // Display-only label for the sheet (e.g. someone temporarily covering this area).
  // Never written back to the agent record — `agent.name` in the database is untouched.
  const displayName = (agent_display_name || '').trim() || agent.name;

  const start = Number(cycle_start_year);
  const years = [start, start + 1, start + 2];

  let parties = db.data.parties.filter(
    p => String(p.agent_id) === String(agent_id) && Number(p.cycle_start_year) === start
  );
  parties = parties.sort((a, b) => (Number(a.s_no) || 0) - (Number(b.s_no) || 0) || a.id - b.id);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Parties');

  // 2 (S.N. + Party Name) + 3 cols per year (Sale Details / Sale Return / Net Sale) + 1 (Remark)
  const totalCols = 2 + years.length * 3 + 1;
  const cycleLabel = `${years[0]}+${String(years[1]).slice(-2)}+${String(years[2]).slice(-2)}`;

  sheet.mergeCells(1, 1, 1, totalCols);
  sheet.getCell(1, 1).value = `CHILDREN BOOK PARTY ORDER DETAIL - ${cycleLabel}`;
  sheet.getCell(1, 1).font = { bold: true, size: 13 };
  sheet.getCell(1, 1).alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, totalCols);
  sheet.getCell(2, 1).value = `Agent Name & Area :- ${displayName} (${area?.label || ''})`;
  sheet.getCell(2, 1).font = { bold: true, size: 11 };
  sheet.getCell(2, 1).alignment = { horizontal: 'center' };

  // Two-row header starting at row 3: S.N./Party Name/Remark span both rows,
  // each year spans 3 columns in row 3 with Sale Details/Sale Return/Net Sale in row 4.
  const headerRow1 = 3;
  const headerRow2 = 4;

  sheet.mergeCells(headerRow1, 1, headerRow2, 1);
  sheet.getCell(headerRow1, 1).value = 'S.N.';

  sheet.mergeCells(headerRow1, 2, headerRow2, 2);
  sheet.getCell(headerRow1, 2).value = 'PARTY NAME';

  let col = 3;
  years.forEach(y => {
    sheet.mergeCells(headerRow1, col, headerRow1, col + 2);
    sheet.getCell(headerRow1, col).value = y;
    sheet.getCell(headerRow2, col).value = 'Sale Details';
    sheet.getCell(headerRow2, col + 1).value = 'Sale Return';
    sheet.getCell(headerRow2, col + 2).value = 'Net Sale';
    col += 3;
  });

  const remarkCol = col;
  sheet.mergeCells(headerRow1, remarkCol, headerRow2, remarkCol);
  sheet.getCell(headerRow1, remarkCol).value = 'Remark';

  for (let r = headerRow1; r <= headerRow2; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    sheet.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  }

  let r = headerRow2 + 1;
  const firstDataRow = r;
  parties.forEach((p, idx) => {
    sheet.getCell(r, 1).value = p.s_no || idx + 1;
    sheet.getCell(r, 2).value = p.party_name || '';
    let c = 3;
    years.forEach(y => {
      const details = Number(p[`sale_details_${y}`]) || 0;
      const ret = Number(p[`sale_return_${y}`]) || 0;
      sheet.getCell(r, c).value = details;
      sheet.getCell(r, c + 1).value = ret;
      sheet.getCell(r, c + 2).value = details - ret;
      c += 3;
    });
    sheet.getCell(r, remarkCol).value = p.remark || '';
    r++;
  });
  const lastDataRow = r - 1;

  // NET TOTAL row (matches the reference PDF's bottom "NET TOTAL:-" row)
  sheet.getCell(r, 2).value = 'NET TOTAL:-';
  if (lastDataRow >= firstDataRow) {
    let c = 3;
    years.forEach(() => {
      for (let i = 0; i < 3; i++) {
        const colLetter = colToLetter(c + i);
        sheet.getCell(r, c + i).value = { formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };
      }
      c += 3;
    });
  }
  sheet.getRow(r).font = { bold: true };
  sheet.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const netTotalRow = r;
  r += 2;

  // Party-wise Total: same party name can appear on multiple rows (repeat orders),
  // so group by trimmed/case-insensitive name and sum Sale Details/Return PER YEAR
  // (not flattened) — matches the main table's year-by-year breakdown.
  const partyYearTotalsMap = {};
  parties.forEach(p => {
    const name = (p.party_name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!partyYearTotalsMap[key]) {
      partyYearTotalsMap[key] = { name, years: {} };
      years.forEach(y => { partyYearTotalsMap[key].years[y] = { details: 0, ret: 0 }; });
    }
    years.forEach(y => {
      partyYearTotalsMap[key].years[y].details += Number(p[`sale_details_${y}`]) || 0;
      partyYearTotalsMap[key].years[y].ret += Number(p[`sale_return_${y}`]) || 0;
    });
  });
  const partyYearTotalsList = Object.values(partyYearTotalsMap).sort((a, b) => a.name.localeCompare(b.name));

  if (partyYearTotalsList.length) {
    sheet.getCell(r, 1).value = 'Party-wise Total';
    sheet.getCell(r, 1).font = { bold: true, size: 12 };
    r++;
    // Reuse the same column layout as the main table: Party Name in column 2 (the
    // wide column), year blocks starting at column 3 — so widths line up visually.
    const ptHeaderRow1 = r;
    const ptHeaderRow2 = r + 1;
    sheet.mergeCells(ptHeaderRow1, 2, ptHeaderRow2, 2);
    sheet.getCell(ptHeaderRow1, 2).value = 'Party Name';
    let c = 3;
    years.forEach(y => {
      sheet.mergeCells(ptHeaderRow1, c, ptHeaderRow1, c + 2);
      sheet.getCell(ptHeaderRow1, c).value = y;
      sheet.getCell(ptHeaderRow2, c).value = 'Sale Details';
      sheet.getCell(ptHeaderRow2, c + 1).value = 'Sale Return';
      sheet.getCell(ptHeaderRow2, c + 2).value = 'Net Sale';
      c += 3;
    });
    const ptLastCol = c - 1;
    for (let row = ptHeaderRow1; row <= ptHeaderRow2; row++) {
      for (let col2 = 2; col2 <= ptLastCol; col2++) {
        const cell = sheet.getCell(row, col2);
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
      sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    }
    r = ptHeaderRow2 + 1;
    partyYearTotalsList.forEach(pt => {
      sheet.getCell(r, 2).value = pt.name;
      let cc = 3;
      years.forEach(y => {
        const yd = pt.years[y];
        sheet.getCell(r, cc).value = yd.details;
        sheet.getCell(r, cc + 1).value = yd.ret;
        sheet.getCell(r, cc + 2).value = yd.details - yd.ret;
        cc += 3;
      });
      r++;
    });
    const ptLastDataRow = r - 1;
    for (let row = ptHeaderRow1; row <= ptLastDataRow; row++) {
      for (let col2 = 2; col2 <= ptLastCol; col2++) {
        sheet.getCell(row, col2).border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      }
    }
  }

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 28;
  for (let c = 3; c < remarkCol; c++) sheet.getColumn(c).width = 13;
  sheet.getColumn(remarkCol).width = 24;

  for (let row = 1; row <= netTotalRow; row++) {
    for (let c = 1; c <= totalCols; c++) {
      sheet.getCell(row, c).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  const filename = `Parties_${displayName.replace(/\s+/g, '_')}_${years.join('-')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;