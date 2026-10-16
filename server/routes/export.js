const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

// Same options as the Type dropdown in client/src/Grid.jsx (BOOK_TYPE_GROUPS +
// BOOK_TYPE_STANDALONE), flattened into one list — Excel's in-cell dropdown
// (data validation) doesn't support grouped/optgroup lists, just a flat one.
const BOOK_TYPE_OPTIONS = [
  'Type A (Complete Set)', 'Type C (Task Book)', 'Eco. Task Copy', 'AL', 'All In One Term Book E/m.',
  'Gyan Bodh', 'Skill Book', 'Practice Book', 'Work Book', 'Art & Craft', 'Play Group - A', 'Play Group - B',
  'Special Set', 'Loose Book',
];

router.get('/challan-issue', async (req, res) => {
  const { agent_id, year } = req.query;
  if (!agent_id || !year) return res.status(400).json({ error: 'agent_id and year are required' });

  const agent = db.data.agents.find(a => a.id === Number(agent_id));
  if (!agent) return res.status(404).json({ error: 'agent not found' });
  const area = db.data.areas.find(a => a.id === agent.area_id);

  const challans = db.data.challans
    .filter(c => String(c.agent_id) === String(agent_id) && String(c.year) === String(year))
    .sort((a, b) => (a.challan_date || '').localeCompare(b.challan_date || '') || (a.s_no || 0) - (b.s_no || 0));
  const returns = db.data.returns
    .filter(r => String(r.agent_id) === String(agent_id) && String(r.year) === String(year))
    .sort((a, b) => (a.return_date || '').localeCompare(b.return_date || '') || (a.s_no || 0) - (b.s_no || 0));

  const rowCount = Math.max(challans.length, returns.length);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('C.Book Challan Issue Details');

  // Columns: S.N.(1) Date(2) Type(3) Challan No.(4) Total Books(5) | Return Date(6) Return Challan No.(7) Return Qty(8) Remark(9)
  const typeCol = 3;
  const challanNoCol = 4;
  const totalBooksCol = 5;
  const returnDateCol = 6;
  const returnChallanCol = 7;
  const returnQtyCol = 8;
  const remarkCol = 9;
  const lastCol = remarkCol;

  const colLetter = (n) => sheet.getColumn(n).letter;

  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `चिल्ड्रन बुक स्पेसिमेन जावक विवरण (एजेंट वाइज)- ${year}`;
  titleCell.font = { bold: true, size: 13 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = `Agent Name & Area :-  ${agent.name} (${area?.label || ''})`;
  sheet.getCell(2, 1).font = { bold: true };

  sheet.mergeCells(3, 1, 3, totalBooksCol);
  sheet.getCell(3, 1).value = 'जावक';
  sheet.getCell(3, 1).font = { bold: true };
  sheet.getCell(3, 1).alignment = { horizontal: 'center' };

  sheet.mergeCells(3, returnDateCol, 3, remarkCol);
  sheet.getCell(3, returnDateCol).value = 'आवक/वापसी';
  sheet.getCell(3, returnDateCol).font = { bold: true };
  sheet.getCell(3, returnDateCol).alignment = { horizontal: 'center' };

  const headerRow = 4;
  const headers = [
    [1, 'S.N.'], [2, 'Date'], [typeCol, challans.find(c => c.book_type)?.book_type || 'Type'], [challanNoCol, 'Challan No.'], [totalBooksCol, 'किताबों की संख्या'],
    [returnDateCol, 'दिनांक'], [returnChallanCol, 'चालान क्रमांक'],
    [returnQtyCol, 'किताबों की संख्या'], [remarkCol, 'रिमार्क'],
  ];
  for (const [col, label] of headers) {
    const c = sheet.getCell(headerRow, col);
    c.value = label;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  sheet.getRow(headerRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  let r = headerRow + 1;
  for (let i = 0; i < rowCount; i++) {
    const c = challans[i];
    const ret = returns[i];

    if (c) {
      sheet.getCell(r, 1).value = c.s_no ?? i + 1;
      sheet.getCell(r, 2).value = c.challan_date;
      sheet.getCell(r, typeCol).value = c.type_qty || '';
      sheet.getCell(r, challanNoCol).value = c.challan_no;
      sheet.getCell(r, totalBooksCol).value = c.total_books || '';
    }

    if (ret) {
      sheet.getCell(r, returnDateCol).value = ret.return_date || '';
      sheet.getCell(r, returnChallanCol).value = ret.challan_no || '';
      sheet.getCell(r, returnQtyCol).value = ret.books_qty || '';
      sheet.getCell(r, remarkCol).value = ret.remark || '';
    }
    r++;
  }

  // Type column heading is the in-cell dropdown (Excel data validation); the cells
  // below hold plain quantities. Header shows the chosen type name.
  sheet.getCell(headerRow, typeCol).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${BOOK_TYPE_OPTIONS.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Invalid Type',
    error: 'Please pick a value from the dropdown list.',
  };

  const firstDataRow = headerRow + 1;
  const lastDataRow = r - 1;

  sheet.getCell(r, challanNoCol).value = 'TOTAL:-';
  sheet.getCell(r, challanNoCol).font = { bold: true };
  if (lastDataRow >= firstDataRow) {
    const totalLetter = colLetter(totalBooksCol);
    sheet.getCell(r, totalBooksCol).value = { formula: `SUM(${totalLetter}${firstDataRow}:${totalLetter}${lastDataRow})` };
  }
  sheet.getCell(r, totalBooksCol).font = { bold: true };

  sheet.getCell(r, returnChallanCol).value = 'TOTAL:-';
  sheet.getCell(r, returnChallanCol).font = { bold: true };
  if (lastDataRow >= firstDataRow) {
    const retLetter = colLetter(returnQtyCol);
    sheet.getCell(r, returnQtyCol).value = { formula: `SUM(${retLetter}${firstDataRow}:${retLetter}${lastDataRow})` };
  }
  sheet.getCell(r, returnQtyCol).font = { bold: true };

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(typeCol).width = 22;
  sheet.getColumn(challanNoCol).width = 14;
  sheet.getColumn(totalBooksCol).width = 14;
  sheet.getColumn(returnDateCol).width = 14;
  sheet.getColumn(returnChallanCol).width = 14;
  sheet.getColumn(returnQtyCol).width = 14;
  sheet.getColumn(remarkCol).width = 24;

  for (let row = 1; row <= r; row++) {
    for (let col = 1; col <= lastCol; col++) {
      sheet.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  const filename = `Challan_Issue_${agent.name.replace(/\s+/g, '_')}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;