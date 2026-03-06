const express = require("express");

function createUiPreferencesRouter({ uiPreferencesService }) {
  const router = express.Router();

  router.get("/display", async (req, res, next) => {
    try {
      if (!req.auth || !req.auth.isAuthenticated) {
        const defaults = uiPreferencesService.getDefaultDisplayPreferences("user");
        return res.json({
          ok: true,
          display: defaults,
          canManageTree: false
        });
      }

      const username = req.auth.user && req.auth.user.username
        ? req.auth.user.username
        : "";
      const role = req.auth.role || "user";
      const result = await uiPreferencesService.getDisplayPreferences(username, role);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/display", async (req, res, next) => {
    try {
      if (!req.auth || !req.auth.isAuthenticated) {
        return res.status(401).json({ ok: false, message: "Authentication required" });
      }

      const username = req.auth.user && req.auth.user.username
        ? req.auth.user.username
        : "";
      const role = req.auth.role || "user";
      const result = await uiPreferencesService.saveDisplayPreferences(username, role, req.body || {});
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createUiPreferencesRouter
};
