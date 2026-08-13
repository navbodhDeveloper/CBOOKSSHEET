const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../db');

router.get('/parties', async (req, res) => {
  const { agent_id } = req.query;
  if (!agent_id) return res.status(400).json({ error: 'agent_id is required' });

  const agent = db.data.agents.find(a => a.id === Number(agent_id));
  if (!agent) return res.status(404).json({ error: 'agent not found' });
  const area = db.data.areas.find(a => a.id === agent.area_id);

  const parties = db.data.parties
    .filter(p => String(p.agent_id) === String(agent_id))
    .sort((a, b) => a.id - b.id);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Parties');

  sheet.mergeCells(1, 1, 1, 6);
  sheet.getCell(1, 1).value = `Parties — ${agent.name} (${area?.label || ''})`;
  sheet.getCell(1, 1).font = { bold: true, size: 13 };
  sheet.getCell(1, 1).alignment = { horizontal: 'center' };

  const headers = ['Order No.', 'Party Name', 'Amount Received', 'Amount Return', 'Remaining Amount', 'Remark'];
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
    sheet.getCell(r, 1).value = p.order_no || '';
    sheet.getCell(r, 2).value = p.party_name || '';
    sheet.getCell(r, 3).value = received;
    sheet.getCell(r, 4).value = ret;
    sheet.getCell(r, 5).value = received - ret;
    sheet.getCell(r, 6).value = p.remark || '';
    r++;
  });

  sheet.getCell(r, 2).value = 'TOTAL:-';
  sheet.getCell(r, 2).font = { bold: true };
  if (parties.length) {
    ['C', 'D', 'E'].forEach((col, i) => {
      sheet.getCell(r, i + 3).value = { formula: `SUM(${col}3:${col}${r - 1})` };
      sheet.getCell(r, i + 3).font = { bold: true };
    });
  }

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 24;

  for (let row = 1; row <= r; row++) {
    for (let col = 1; col <= 6; col++) {
      sheet.getCell(row, col).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }

  const filename = `Parties_${agent.name.replace(/\s+/g, '_')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router; 