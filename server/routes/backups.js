const express = require("express");
const multer = require("multer");

const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");

function createBackupsRouter({ config, backupService }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.backups.uploadMaxBytes }
  });

  router.use(requireAuth(), requireRole("superadmin"));

  router.get("/settings", async (_req, res, next) => {
    try {
      const settings = await backupService.getSettings();
      const runtime = backupService.getRuntime();
      return res.json({ ok: true, settings, runtime });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/settings", async (req, res, next) => {
    try {
      const result = await backupService.updateSettings(req.body || {});
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/runs", async (req, res, next) => {
    try {
      const limit = req.query && req.query.limit ? Number(req.query.limit) : undefined;
      const runs = await backupService.listRuns(limit);
      return res.json({ ok: true, runs, activeRun: backupService.getActiveRun() });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/runs/:runId", async (req, res, next) => {
    try {
      const run = await backupService.getRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ ok: false, message: "Run not found." });
      }
      return res.json({ ok: true, run });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/runs/:runId/stream", async (req, res, next) => {
    try {
      const runId = String(req.params.runId || "").trim();

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      const sendEvent = (eventName, payload) => {
        const body = JSON.stringify(payload || {});
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${body}\n\n`);
      };

      const activeRun = backupService.getActiveRun();
      if (!activeRun || activeRun.id !== runId) {
        const run = await backupService.getRun(runId);
        if (!run) {
          sendEvent("not-found", { ok: false, message: "Run not found." });
          res.end();
          return;
        }

        sendEvent("snapshot", { ok: true, run });
        sendEvent("complete", { ok: true, runId, status: run.status });
        res.end();
        return;
      }

      sendEvent("snapshot", {
        ok: true,
        activeRun
      });

      const unsubscribe = backupService.subscribeToRun(runId, (payload) => {
        sendEvent("progress", payload);
        if (payload.eventType === "status" && payload.status && payload.status !== "running") {
          sendEvent("complete", {
            ok: true,
            runId,
            status: payload.status,
            errorMessage: payload.errorMessage || ""
          });
          cleanup();
          res.end();
        }
      });

      const heartbeat = setInterval(() => {
        res.write(": ping\n\n");
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.on("close", cleanup);
      req.on("error", cleanup);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/run", async (req, res, next) => {
    try {
      const actor = req.session && req.session.user ? req.session.user.username : "system";
      const result = await backupService.startManualBackup(req.body || {}, actor);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/runs/:archiveId", async (req, res, next) => {
    try {
      const result = await backupService.deleteRunByArchiveOrId(req.params.archiveId);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/download/:archiveId", async (req, res, next) => {
    try {
      const result = await backupService.resolveArchiveForDownload(req.params.archiveId);
      if (!result.ok) {
        return res.status(404).json(result);
      }

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Length", String(result.sizeBytes));
      res.setHeader("Content-Disposition", `attachment; filename=\"${result.archiveId}\"`);
      const stream = require("node:fs").createReadStream(result.archivePath);
      stream.on("error", next);
      stream.pipe(res);
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    "/restore",
    (req, res, next) => {
      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      if (!contentType.includes("multipart/form-data")) {
        return next();
      }
      return upload.single("archive")(req, res, (error) => {
        if (error && error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            ok: false,
            message: "Uploaded backup archive exceeds the configured size limit."
          });
        }
        if (error) {
          return next(error);
        }
        return next();
      });
    },
    async (req, res, next) => {
      try {
        const actor = req.session && req.session.user ? req.session.user.username : "system";
        const sourceType = String(req.body && req.body.sourceType ? req.body.sourceType : "existing").trim().toLowerCase();

        let result;
        if (sourceType === "upload") {
          result = await backupService.startRestoreFromUpload(req.body || {}, req.file, actor);
        } else {
          result = await backupService.startRestoreFromExisting(req.body || {}, actor);
        }

        return res.status(result.ok ? 200 : 400).json(result);
      } catch (error) {
        return next(error);
      }
    }
  );

  return router;
}

module.exports = {
  createBackupsRouter
};
