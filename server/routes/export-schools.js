const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

const LIST_LABELS = {
  MASTER: 'School Master List',
  MASTER_NEW: 'School Master List (NEW)',
  CBSE: 'CBSE',
};

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

  ['visit_1', 'School Visit Date / App Location - \nI', 16],
  ['visit_2', 'School Visit Date / App Location - II', 16],
  ['visit_3', 'School Visit Date / App Location- III', 16],

  ['supplying_party', 'Supplying Party', 16],
  ['discussion_2023', 'Discussion 2023', 24],
  ['discussion_2024', 'Discussion 2024', 24],
  ['remark', 'Remark', 20],
];

router.get('/school-list', async (req, res) => {
  const { list_type, agent_id, fields } = req.query;
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
  schools = schools.sort((a, b) => a.id - b.id);

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

  const headerRow = 3;
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
        sheet.getCell(r, idx + 2).value = val;
      }
    });
  });

  sheet.getColumn(1).width = 6;
  activeColumns.forEach(([, , width], idx) => {
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

  const filename = `${LIST_LABELS[list_type].replace(/[^\w]+/g, '_')}${isPartial ? '_partial' : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;