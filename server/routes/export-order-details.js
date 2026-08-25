// const express = require('express');
// const router = express.Router();
// const ExcelJS = require('exceljs');
// const { db } = require('../db');

// router.get('/order-details', async (req, res) => {
//   const { agent_id, cycle_start_year } = req.query;
//   if (!agent_id || !cycle_start_year) {
//     return res.status(400).json({ error: 'agent_id and cycle_start_year are required' });
//   }
//   const agent = db.data.agents.find(a => a.id === Number(agent_id));
//   if (!agent) return res.status(404).json({ error: 'agent not found' });
//   const area = db.data.areas.find(a => a.id === agent.area_id);

//   const startYear = Number(cycle_start_year);
//   const years = [startYear, startYear + 1, startYear + 2];

//   const rows = db.data.order_rows
//     .filter(r => String(r.agent_id) === String(agent_id) && String(r.cycle_start_year) === String(cycle_start_year))
//     .sort((a, b) => (a.s_no || 0) - (b.s_no || 0) || a.id - b.id)
//     .map(r => ({ ...r, years: db.data.order_row_years.filter(y => y.order_row_id === r.id) }));

//   const workbook = new ExcelJS.Workbook();
//   const sheet = workbook.addWorksheet('03 Years Spec. Dis. Order Detail');

//   // Layout: A=S.N. B=Name, then per year 7 cols (elig,given,returned,balance,order_amt,order_ret_amt,balance_amt) + 1 gap
//   const yearBlockWidth = 7;
//   const colStarts = years.map((y, i) => 3 + i * (yearBlockWidth + 1)); // C, K, S ...
//   const newSchoolCol = colStarts[2] + yearBlockWidth; // after last year block
//   const remarkCol = newSchoolCol + 1;
//   const lastCol = remarkCol;

//   sheet.mergeCells(1, 1, 1, lastCol);
//   sheet.getCell(1, 1).value = `CHILDREN BOOK SPEC. DISTRIBUTE & ORDER DETAIL - ${years.join('+')}`;
//   sheet.getCell(1, 1).font = { bold: true, size: 13 };
//   sheet.getCell(1, 1).alignment = { horizontal: 'center' };

//   sheet.mergeCells(2, 1, 2, lastCol);
//   sheet.getCell(2, 1).value = `Agent Name & Area :-  ${agent.name} (${area?.label || ''})`;
//   sheet.getCell(2, 1).font = { bold: true };

//   const headerRow = 3;
//   sheet.mergeCells(headerRow, 1, headerRow + 1, 1);
//   sheet.getCell(headerRow, 1).value = 'S.N.';
//   sheet.mergeCells(headerRow, 2, headerRow + 1, 2);
//   sheet.getCell(headerRow, 2).value = 'SCHOOL/PARTY NAME';

//   years.forEach((year, i) => {
//     const start = colStarts[i];
//     sheet.mergeCells(headerRow, start, headerRow, start + yearBlockWidth - 1);
//     sheet.getCell(headerRow, start).value = year;
//     sheet.getCell(headerRow, start).alignment = { horizontal: 'center' };

//     sheet.mergeCells(headerRow + 1, start, headerRow + 1, start);
//     sheet.getCell(headerRow + 1, start).value = 'योग्य/अयोग्य';
//     sheet.mergeCells(headerRow + 1, start + 1, headerRow + 1, start + 3);
//     sheet.getCell(headerRow + 1, start + 1).value = 'स्पेसिमेन (बांटा/वापसी/शेष)';
//     sheet.getCell(headerRow + 2, start + 1).value = 'बांटा';
//     sheet.getCell(headerRow + 2, start + 2).value = 'वापसी';
//     sheet.getCell(headerRow + 2, start + 3).value = 'शेष';
//     sheet.getCell(headerRow + 1, start + 4).value = 'आर्डर विवरण';
//     sheet.getCell(headerRow + 1, start + 5).value = 'आर्डर वापसी';
//     sheet.getCell(headerRow + 1, start + 6).value = 'शेष राशि';
//   });

//   sheet.mergeCells(headerRow, newSchoolCol, headerRow + 2, newSchoolCol);
//   sheet.getCell(headerRow, newSchoolCol).value = `New School ${years[years.length - 1]}`;
//   sheet.mergeCells(headerRow, remarkCol, headerRow + 2, remarkCol);
//   sheet.getCell(headerRow, remarkCol).value = 'रिमार्क';

//   for (let c = 1; c <= lastCol; c++) {
//     for (let r = headerRow; r <= headerRow + 2; r++) {
//       const cell = sheet.getCell(r, c);
//       cell.font = { bold: true };
//       cell.alignment = { ...cell.alignment, vertical: 'middle', wrapText: true, horizontal: 'center' };
//     }
//   }
//   for (let r = headerRow; r <= headerRow + 2; r++) sheet.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

//   let r = headerRow + 3;
//   rows.forEach((row, i) => {
//     sheet.getCell(r, 1).value = row.s_no ?? i + 1;
//     sheet.getCell(r, 2).value = row.school_party_name;
//     years.forEach((year, yi) => {
//       const start = colStarts[yi];
//       const yd = row.years.find(y => y.year === year);
//       if (yd) {
//         if (yd.elig) sheet.getCell(r, start).value = yd.elig;
//         if (yd.given) sheet.getCell(r, start + 1).value = yd.given;
//         if (yd.returned) sheet.getCell(r, start + 2).value = yd.returned;
//         if (yd.balance) sheet.getCell(r, start + 3).value = yd.balance;
//         if (yd.order_amt) sheet.getCell(r, start + 4).value = yd.order_amt;
//         if (yd.order_ret_amt) sheet.getCell(r, start + 5).value = yd.order_ret_amt;
//         if (yd.balance_amt) sheet.getCell(r, start + 6).value = yd.balance_amt;
//       }
//     });
//     if (row.new_school_flag) sheet.getCell(r, newSchoolCol).value = 'Y';
//     if (row.remark) sheet.getCell(r, remarkCol).value = row.remark;
//     r++;
//   });

//   // NET TOTAL row
//   sheet.getCell(r, 2).value = 'NET TOTAL:-';
//   sheet.getCell(r, 2).font = { bold: true };
//   years.forEach((year, yi) => {
//     const start = colStarts[yi];
//     ['given', 'returned', 'balance', 'order_amt', 'order_ret_amt', 'balance_amt'].forEach((field, fi) => {
//       const col = start + 1 + fi;
//       const colLetter = sheet.getColumn(col).letter;
//       sheet.getCell(r, col).value = { formula: `SUM(${colLetter}${headerRow + 3}:${colLetter}${r - 1})` };
//       sheet.getCell(r, col).font = { bold: true };
//     });
//   });
//   r += 2;

//   // Column widths & borders
//   sheet.getColumn(1).width = 5;
//   sheet.getColumn(2).width = 32;
//   for (let c = 3; c <= lastCol; c++) sheet.getColumn(c).width = 10;
//   for (let row_ = 1; row_ < r; row_++) {
//     for (let c = 1; c <= lastCol; c++) {
//       sheet.getCell(row_, c).border = {
//         top: { style: 'thin' }, left: { style: 'thin' },
//         bottom: { style: 'thin' }, right: { style: 'thin' },
//       };
//     }
//   }

//   const filename = `Order_Detail_${agent.name.replace(/\s+/g, '_')}_${years.join('-')}.xlsx`;
//   res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//   await workbook.xlsx.write(res);
//   res.end();
// });

// module.exports = router;