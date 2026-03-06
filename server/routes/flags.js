const express = require("express");
const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");
const {
  ROLE_VALUES,
  RESTRICTION_VALUES,
  RESERVED_FLAG_NAMES,
  BOOTSTRAP_TEXT_COLOR_CLASSES,
  BOOTSTRAP_ICON_CLASSES
} = require("../services/flag-service");

function createFlagsRouter({ flagService, kbService }) {
  const router = express.Router();
  router.use(requireAuth(), requireRole("superadmin"));

  const syncSearchIndex = async (mutation) => {
    if (!kbService || typeof mutation !== "function") {
      return;
    }

    try {
      await mutation();
    } catch {
      if (typeof kbService.markSearchIndexDirty === "function") {
        kbService.markSearchIndexDirty("flag-mutation-sync-failed");
      }
    }
  };

  router.get("/", async (_req, res, next) => {
    try {
      const flags = await flagService.listDefinitions();
      const uiSettings = await flagService.getUiSettings();
      return res.json({
        ok: true,
        flags,
        uiSettings,
        allowedRoles: ROLE_VALUES,
        allowedRestrictionTypes: RESTRICTION_VALUES,
        allowedColorClasses: BOOTSTRAP_TEXT_COLOR_CLASSES,
        allowedIconClasses: BOOTSTRAP_ICON_CLASSES,
        reservedNames: RESERVED_FLAG_NAMES
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const result = await flagService.createDefinition(req.body || {});
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/update", async (req, res, next) => {
    try {
      const { existingName } = req.body || {};
      const result = await flagService.updateDefinition(existingName, req.body || {});
      if (result.ok) {
        await syncSearchIndex(() => kbService.clearSearchResultCache("flag-definition-update"));
      }
      if (result.ok && Number(result.renamedAssignments || 0) > 0) {
        await syncSearchIndex(() => kbService.rebuildSearchIndex("flag-rename-assignments"));
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/settings", async (req, res, next) => {
    try {
      const result = await flagService.updateUiSettings(req.body || {});
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/delete", async (req, res, next) => {
    try {
      const { name } = req.body || {};
      const result = await flagService.deleteDefinition(name);
      if (result.ok) {
        await syncSearchIndex(() => kbService.clearSearchResultCache("flag-definition-delete"));
      }
      if (result.ok && Number(result.removedAssignments || 0) > 0) {
        await syncSearchIndex(() => kbService.rebuildSearchIndex("flag-delete-assignments"));
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createFlagsRouter
};
