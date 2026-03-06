const express = require("express");
const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");

function createApprovalsRouter({ approvalService }) {
  const router = express.Router();
  router.use(requireAuth(), requireRole("superadmin"));

  router.get("/settings", async (_req, res, next) => {
    try {
      const result = await approvalService.getSettings();
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/settings", async (req, res, next) => {
    try {
      const result = await approvalService.saveSettings(req.body || {});
      const status = result.ok ? 200 : 400;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createApprovalsRouter
};
