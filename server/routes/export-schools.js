const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

const LIST_LABELS = {
  MASTER: 'School Master List',
  MASTER_NEW: 'School Master List (NEW)',
  CBSE: 'CBSE',
};

// [field, header label, width] — 'null' field = computed column
const COLUMNS = [
  ['school_code', 'School Code', 14],
  ['school_name_address', 'School Name / Address', 40],
  ['principal_name_mobile', 'Principal Name / Mobile No.', 26],
  ['grade', 'Grade', 8],
  ['medium', 'Medium', 8],
  ['board', 'Board', 8],
  ['specimen_give_month', 'Specimen Give Month', 12],
  ['book_delivery_month', 'Book Delivery Month', 12],
  ['specimen_given_2021', 'Specimen Given 2021', 10],
  ['specimen_given_2022', 'Specimen Given 2022', 10],
  ['specimen_given_2023', 'Specimen Given 2023', 10],
  ['specimen_returned_2021', 'Specimen Returned 2021', 10],
  ['specimen_returned_2022', 'Specimen Returned 2022', 10],
  ['specimen_returned_2023', 'Specimen Returned 2023', 10],
  [null, '2021 NET SPE', 10, s => (Number(s.specimen_given_2021) || 0) - (Number(s.specimen_returned_2021) || 0)],
  [null, '2022 NET SPE', 10, s => (Number(s.specimen_given_2022) || 0) - (Number(s.specimen_returned_2022) || 0)],
  [null, '2023 NET SPE', 10, s => (Number(s.specimen_given_2023) || 0) - (Number(s.specimen_returned_2023) || 0)],
  ['visit_1', '(Date/Location)', 16],
  ['visit_2', '(Date/Location)', 16],
  ['visit_3', '(Date/Location)', 16],
  ['order_2021', '21 Order', 10],
  ['vapasi_2021', '21 Vapasi', 10],
  [null, '21 Net Order', 10, s => (Number(s.order_2021) || 0) - (Number(s.vapasi_2021) || 0)],
  ['order_2022', '22 Order', 10],
  ['vapasi_2022', '22 Vapasi', 10],
  [null, '22 Net Order', 10, s => (Number(s.order_2022) || 0) - (Number(s.vapasi_2022) || 0)],
  ['order_2023', '23 Order', 10],
  ['vapasi_2023', '23 Vapasi', 10],
  [null, '23 Net Order', 10, s => (Number(s.order_2023) || 0) - (Number(s.vapasi_2023) || 0)],
  ['yog_amt', 'Yog', 8],
  ['ayog_amt', 'Ayog', 8],
  ['total_amt', 'Total', 8],
  [null, 'Remaining', 8, s => (Number(s.total_amt) || 0) - (Number(s.yog_amt) || 0) - (Number(s.ayog_amt) || 0)],
  ['supplying_party', 'Supplying Party', 16],
  ['discussion_2023', 'Discussion 2023', 24],
  ['discussion_2024', 'Discussion 2024', 24],
  ['remark', 'Remark', 20],
];

router.get('/school-list', async (req, res) => {
  const { list_type, agent_id } = req.query;
  if (!list_type || !LIST_LABELS[list_type]) {
    return res.status(400).json({ error: 'valid list_type is required (MASTER, MASTER_NEW, or CBSE)' });
  }

  let schools = db.data.schools
    .filter(s => s.list_type === list_type);
  if (agent_id) schools = schools.filter(s => String(s.agent_id) === String(agent_id));
  schools = schools
    .sort((a, b) => a.id - b.id);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(LIST_LABELS[list_type]);

  const lastCol = COLUMNS.length + 1; // +1 for S.N.

  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'Children Book School Master List';
  titleCell.font = { bold: true, size: 13 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = `List: ${LIST_LABELS[list_type]}`;
  sheet.getCell(2, 1).font = { bold: true };

  const headerRow = 3;
  sheet.getCell(headerRow, 1).value = 'S.N.';
  sheet.getCell(headerRow, 1).font = { bold: true };
  COLUMNS.forEach(([field, label], idx) => {
    const cell = sheet.getCell(headerRow, idx + 2);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sheet.getRow(headerRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  schools.forEach((school, i) => {
    const r = headerRow + 1 + i;
    sheet.getCell(r, 1).value = i + 1;
    COLUMNS.forEach(([field, , , compute], idx) => {
      const val = compute ? compute(school) : school[field];
      if (val !== null && val !== undefined && val !== '') {
        sheet.getCell(r, idx + 2).value = val;
      }
    });
  });

  sheet.getColumn(1).width = 6;
  COLUMNS.forEach(([, , width], idx) => {
    sheet.getColumn(idx + 2).width = width;
  });

  const lastRow = headerRow + schools.length;
  for (let row = 1; row <= lastRow; row++) {
    for (let col = 1; col <= lastCol; col++) {
      sheet.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  const filename = `${LIST_LABELS[list_type].replace(/[^\w]+/g, '_')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;