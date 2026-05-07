'use strict';

const reportService = require('../services/reportService');
const { NotFound } = require('../utils/httpErrors');

async function listReports(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const { rows, total } = await reportService.listReports({
    status: req.query.status,
    page,
    limit,
  });
  return res.json({
    data: rows,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

async function resolveReport(req, res) {
  const id = req.params.id;
  const report = await reportService.findReportById(id);
  if (!report) throw NotFound('Reporte no encontrado');
  await reportService.resolveReport({
    id,
    status: req.body.status,
    reviewerUserId: req.user.id,
  });
  const fresh = await reportService.findReportById(id);
  return res.json({ data: fresh });
}

module.exports = { listReports, resolveReport };
