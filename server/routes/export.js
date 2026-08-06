const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

router.get('/challan-issue', async (req, res) => {
  const { agent_id, year } = req.query;
  if (!agent_id || !year) return res.status(400).json({ error: 'agent_id and year are required' });

  const agent = db.data.agents.find(a => a.id === Number(agent_id));
  if (!agent) return res.status(404).json({ error: 'agent not found' });
  const area = db.data.areas.find(a => a.id === agent.area_id);

  const bookTypes = [...db.data.book_types].sort((a, b) => a.sort_order - b.sort_order);
  const navbodh = bookTypes.filter(b => b.category === 'नवबोध सेट');
  const gyanbodh = bookTypes.filter(b => b.category === 'ज्ञानबोध सेट');
  const special = bookTypes.find(b => b.code === 'SPECIAL_SET');
  const loose = bookTypes.find(b => b.code === 'LOOSE_BOOK');
  const orderedTypes = [...navbodh, ...gyanbodh];

  const challans = db.data.challans
    .filter(c => String(c.agent_id) === String(agent_id) && String(c.year) === String(year))
    .sort((a, b) => (a.challan_date || '').localeCompare(b.challan_date || '') || (a.s_no || 0) - (b.s_no || 0));
  const returns = db.data.returns
    .filter(r => String(r.agent_id) === String(agent_id) && String(r.year) === String(year))
    .sort((a, b) => (a.return_date || '').localeCompare(b.return_date || '') || (a.s_no || 0) - (b.s_no || 0));

  const rowCount = Math.max(challans.length, returns.length);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('C.Book Challan Issue Details');

  const firstTypeCol = 4;
  const specialCol = firstTypeCol + orderedTypes.length;
  const looseCol = specialCol + 1;
  const totalBooksCol = looseCol + 1;
  const returnDateCol = totalBooksCol + 1;
  const returnChallanCol = returnDateCol + 1;
  const returnQtyCol = returnChallanCol + 1;
  const remarkCol = returnQtyCol + 1;
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
  const setNameRow = 5;
  const setSizeRow = 6;

  const singleColHeaders = [
    [1, 'S.N.'], [2, 'Date'], [3, 'Challan No.'],
    [specialCol, 'Special Set'], [looseCol, 'Loose Book'], [totalBooksCol, 'किताबों की संख्या'],
    [returnDateCol, 'दिनांक'], [returnChallanCol, 'चालान क्रमांक'],
    [returnQtyCol, 'किताबों की संख्या'], [remarkCol, 'रिमार्क'],
  ];
  for (const [col, label] of singleColHeaders) {
    sheet.mergeCells(headerRow, col, setNameRow + 1, col);
    const c = sheet.getCell(headerRow, col);
    c.value = label;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  if (navbodh.length) {
    sheet.mergeCells(headerRow, firstTypeCol, headerRow, firstTypeCol + navbodh.length - 1);
    sheet.getCell(headerRow, firstTypeCol).value = 'नवबोध सेट';
    sheet.getCell(headerRow, firstTypeCol).font = { bold: true };
    sheet.getCell(headerRow, firstTypeCol).alignment = { horizontal: 'center' };
  }
  if (gyanbodh.length) {
    const gStart = firstTypeCol + navbodh.length;
    sheet.mergeCells(headerRow, gStart, headerRow, gStart + gyanbodh.length - 1);
    sheet.getCell(headerRow, gStart).value = 'ज्ञानबोध सेट';
    sheet.getCell(headerRow, gStart).font = { bold: true };
    sheet.getCell(headerRow, gStart).alignment = { horizontal: 'center' };
  }

  orderedTypes.forEach((bt, idx) => {
    const col = firstTypeCol + idx;
    const nameCell = sheet.getCell(setNameRow, col);
    nameCell.value = bt.name_english;
    nameCell.font = { bold: true };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const sizeCell = sheet.getCell(setSizeRow, col);
    sizeCell.value = bt.set_size ? `${bt.set_size}\nBooks` : '';
    sizeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  let r = headerRow + 3;
  for (let i = 0; i < rowCount; i++) {
    const c = challans[i];
    const ret = returns[i];

    if (c) {
      sheet.getCell(r, 1).value = c.s_no ?? i + 1;
      sheet.getCell(r, 2).value = c.challan_date;
      sheet.getCell(r, 3).value = c.challan_no;
      const map = {};
      for (const it of (c.items || [])) {
        const bt = bookTypes.find(b => b.id === it.book_type_id);
        if (bt) map[bt.code] = it.quantity;
      }
      orderedTypes.forEach((bt, idx) => {
        const q = map[bt.code];
        if (q) sheet.getCell(r, firstTypeCol + idx).value = q;
      });
      if (special && map[special.code]) sheet.getCell(r, specialCol).value = map[special.code];
      if (loose && map[loose.code]) sheet.getCell(r, looseCol).value = map[loose.code];
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

  sheet.getCell(r, 3).value = 'TOTAL:-';
  sheet.getCell(r, 3).font = { bold: true };
  orderedTypes.forEach((bt, idx) => {
    const col = firstTypeCol + idx;
    const letter = colLetter(col);
    sheet.getCell(r, col).value = { formula: `SUM(${letter}${headerRow + 3}:${letter}${r - 1})` };
    sheet.getCell(r, col).font = { bold: true };
  });
  if (special) {
    const letter = colLetter(specialCol);
    sheet.getCell(r, specialCol).value = { formula: `SUM(${letter}${headerRow + 3}:${letter}${r - 1})` };
  }
  if (loose) {
    const letter = colLetter(looseCol);
    sheet.getCell(r, looseCol).value = { formula: `SUM(${letter}${headerRow + 3}:${letter}${r - 1})` };
  }
  {
    const letter = colLetter(totalBooksCol);
    sheet.getCell(r, totalBooksCol).value = { formula: `SUM(${letter}${headerRow + 3}:${letter}${r - 1})` };
    sheet.getCell(r, totalBooksCol).font = { bold: true };
  }
  sheet.getCell(r, returnChallanCol).value = 'TOTAL:-';
  sheet.getCell(r, returnChallanCol).font = { bold: true };
  {
    const letter = colLetter(returnQtyCol);
    sheet.getCell(r, returnQtyCol).value = { formula: `SUM(${letter}${headerRow + 3}:${letter}${r - 1})` };
    sheet.getCell(r, returnQtyCol).font = { bold: true };
  }

  for (let col = 1; col <= lastCol; col++) {
    sheet.getColumn(col).width = col <= 3 ? 12 : 10;
  }
  for (let row = 1; row <= r; row++) {
    for (let col = 1; col <= lastCol; col++) {
      sheet.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  const filename = `Challan_Issue_${agent.name.replace(/\s+/g, '_')}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
