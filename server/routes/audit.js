const express = require("express");

const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");
const { requireAuditAccess } = require("../middleware/require-audit-access");

function createAuditRouter({ auditService }) {
  const router = express.Router();
  router.use(requireAuth(), requireAuditAccess());

  router.get("/events", (req, res, next) => {
    try {
      const result = auditService.queryEvents(req.query || {});
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/export.csv", (req, res, next) => {
    try {
      const csv = auditService.exportCsv(req.query || {});
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"audit-events.csv\"");
      return res.status(200).send(csv);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/settings", (_req, res, next) => {
    try {
      const snapshot = auditService.getSettingsSnapshot();
      return res.json(snapshot);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

function createSuperadminAuditRouter({ auditService }) {
  const router = express.Router();
  router.use(requireAuth(), requireRole("superadmin"));

  router.post("/settings", async (req, res, next) => {
    try {
      const actor = req.session && req.session.user ? req.session.user.username : "system";
      const result = await auditService.updateSettings(req.body || {}, actor);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAuditRouter,
  createSuperadminAuditRouter
};