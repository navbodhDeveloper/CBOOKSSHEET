const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

router.get('/parties', async (req, res) => {
  const { agent_id, cycle_start_year } = req.query;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });

  const agent = db.data.agents.find(a => a.id === Number(agent_id));
  if (!agent) return res.status(404).json({ error: 'agent not found' });
  const area = db.data.areas.find(a => a.id === agent.area_id);

  let parties = db.data.parties.filter(p => String(p.agent_id) === String(agent_id));

  let years = [];
  if (cycle_start_year) {
    const start = Number(cycle_start_year);
    years = [start, start + 1, start + 2];
    parties = parties.filter(p => years.includes(Number(p.year)));
  }
  parties = parties.sort((a, b) => (a.year || 0) - (b.year || 0) || a.id - b.id);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Parties');

  sheet.mergeCells(1, 1, 1, 6);
  sheet.getCell(1, 1).value = `Parties — ${agent.name} (${area?.label || ''})${years.length ? ` — ${years.join('-')}` : ''}`;
  sheet.getCell(1, 1).font = { bold: true, size: 13 };
  sheet.getCell(1, 1).alignment = { horizontal: 'center' };

  const headers = ['Year', 'Order No.', 'Party Name', 'Amount Received', 'Amount Return', 'Remaining Amount', 'Remark'];
  headers.forEach((h, i) => {
    const c = sheet.getCell(2, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
  });
  sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  let r = 3;
  parties.forEach(p => {
    const received = Number(p.amt_received) || 0;
    const ret = Number(p.amt_return) || 0;
    sheet.getCell(r, 1).value = p.year || '';
    sheet.getCell(r, 2).value = p.order_no || '';
    sheet.getCell(r, 3).value = p.party_name || '';
    sheet.getCell(r, 4).value = received;
    sheet.getCell(r, 5).value = ret;
    sheet.getCell(r, 6).value = received - ret;
    sheet.getCell(r, 7).value = p.remark || '';
    r++;
  });

  const firstDataRow = 3;
  const lastDataRow = r - 1;

  sheet.getCell(r, 3).value = 'TOTAL:-';
  sheet.getCell(r, 3).font = { bold: true };
  if (lastDataRow >= firstDataRow) {
    ['D', 'E', 'F'].forEach(col => {
      sheet.getCell(r, col.charCodeAt(0) - 64).value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})` };
      sheet.getCell(r, col.charCodeAt(0) - 64).font = { bold: true };
    });
  }
  r += 2;

  if (years.length) {
    sheet.getCell(r, 1).value = 'NET TOTAL';
    sheet.getCell(r, 1).font = { bold: true, size: 12 };
    r++;
    const sumHeaders = ['Year', 'Amount Received', 'Amount Return', 'Remaining Amount'];
    sumHeaders.forEach((h, i) => {
      const c = sheet.getCell(r, i + 1);
      c.value = h;
      c.font = { bold: true };
    });
    sheet.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    r++;
    years.forEach(y => {
      const yearRows = parties.filter(p => Number(p.year) === y);
      const received = yearRows.reduce((s, p) => s + (Number(p.amt_received) || 0), 0);
      const ret = yearRows.reduce((s, p) => s + (Number(p.amt_return) || 0), 0);
      sheet.getCell(r, 1).value = y;
      sheet.getCell(r, 2).value = received;
      sheet.getCell(r, 3).value = ret;
      sheet.getCell(r, 4).value = received - ret;
      r++;
    });
  }

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 26;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 16;
  sheet.getColumn(7).width = 20;

  for (let row = 1; row <= lastDataRow + 1; row++) {
    for (let col = 1; col <= 7; col++) {
      sheet.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  const filename = `Parties_${agent.name.replace(/\s+/g, '_')}${years.length ? '_' + years.join('-') : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;