const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const { normalizeKbRelativePath, resolveKbPath } = require("../utils/path-utils");
const { createReadRateLimiter, createSearchRateLimiter } = require("../middleware/rate-limit");

function createReadRouter({ kbService, config, flagService }) {
  const router = express.Router();
  const readRateLimiter = createReadRateLimiter(config);
  const searchRateLimiter = createSearchRateLimiter(config);

  router.get("/public/stats", readRateLimiter, async (_req, res, next) => {
    try {
      const solutionCount = await kbService.countSolutions();
      return res.json({ ok: true, solutionCount });
    } catch (error) {
      return next(error);
    }
  });

  router.use((req, res, next) => {
    if (config.auth.mode === "required" && (!req.auth || !req.auth.isAuthenticated)) {
      return res.status(401).json({ ok: false, message: "Authentication required" });
    }
    return next();
  });

  router.get("/asset/*", async (req, res) => {
    try {
      const wildcard = req.params && typeof req.params[0] === "string" ? req.params[0] : "";
      const relativeAssetPath = normalizeKbRelativePath(wildcard);
      if (!relativeAssetPath) {
        return res.status(404).end();
      }

      const resolved = resolveKbPath(config.paths.kbRootAbsolute, relativeAssetPath);
      const extension = path.extname(resolved.absolute).toLowerCase().replace(".", "");
      if (!config.uploads.allowedImageExtensions.includes(extension)) {
        return res.status(404).end();
      }

      const stats = await fs.stat(resolved.absolute).catch(() => null);
      if (!stats || !stats.isFile()) {
        return res.status(404).end();
      }

      return res.sendFile(resolved.absolute);
    } catch {
      return res.status(404).end();
    }
  });

  router.get("/ui/settings", readRateLimiter, async (_req, res, next) => {
    try {
      const uiSettings = await flagService.getUiSettings();
      return res.json({ ok: true, uiSettings });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/topics", readRateLimiter, async (_req, res, next) => {
    try {
      const response = await kbService.listTopics();
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/search", searchRateLimiter, async (req, res, next) => {
    try {
      const query = String(req.query.q || "");
      const page = req.query.page;
      const pageSize = req.query.pageSize;
      const response = await kbService.searchSolutions(
        query,
        { page, pageSize },
        req.auth || null
      );
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/node", readRateLimiter, async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const response = await kbService.readNode(kbPath, req.auth || null);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createReadRouter
};
