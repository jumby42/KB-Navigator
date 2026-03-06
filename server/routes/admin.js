const express = require("express");
const path = require("path");
const multer = require("multer");
const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");
const { createAdminWriteRateLimiter } = require("../middleware/rate-limit");

function createAdminRouter({ config, kbAdminService, trashService, lockService, draftService, versionService, kbService, approvalService }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.uploads.maxImageBytes }
  });

  router.use(requireAuth(), requireRole(["admin", "superadmin"]));
  const adminWriteRateLimiter = createAdminWriteRateLimiter(config);
  router.use(adminWriteRateLimiter);

  const syncSearchIndex = async (mutation) => {
    if (!kbService || typeof mutation !== "function") {
      return;
    }

    try {
      await mutation();
    } catch {
      if (typeof kbService.markSearchIndexDirty === "function") {
        kbService.markSearchIndexDirty("admin-mutation-sync-failed");
      }
    }
  };

  const markTreeCacheDirty = (reason) => {
    if (kbAdminService && typeof kbAdminService.markTreeCacheDirty === "function") {
      kbAdminService.markTreeCacheDirty(reason);
    }
  };

  const markReadCacheDirty = (reason) => {
    if (kbService && typeof kbService.markReadCacheDirty === "function") {
      kbService.markReadCacheDirty(reason);
    }
  };

  const isApprover = (req) => Boolean(req && req.auth && req.auth.user && req.auth.user.canApprove);

  const getApprovalSettings = async () => {
    if (!approvalService) {
      return { flagEditsRequireApproval: false };
    }

    const result = await approvalService.getSettings();
    if (!result || !result.ok || !result.settings) {
      return { flagEditsRequireApproval: false };
    }

    return {
      flagEditsRequireApproval: Boolean(result.settings.flagEditsRequireApproval)
    };
  };

  router.get("/tree", async (_req, res, next) => {
    try {
      const [treePayload, trashPayload] = await Promise.all([
        kbAdminService.getKnowledgebaseTreeSerialized(),
        typeof trashService.getTrashRootSerialized === "function"
          ? trashService.getTrashRootSerialized()
          : Promise.resolve(null)
      ]);

      if (treePayload && treePayload.ok && treePayload.serialized) {
        const trashSerialized = trashPayload && trashPayload.ok && trashPayload.serialized
          ? trashPayload.serialized
          : JSON.stringify((await trashService.listItems()).trashRoot);

        if (Number.isFinite(treePayload.version)) {
          res.set("x-kbn-tree-cache-version", String(treePayload.version));
        }
        if (trashPayload && Number.isFinite(trashPayload.version)) {
          res.set("x-kbn-trash-cache-version", String(trashPayload.version));
        }

        const body = `{"ok":true,"knowledgebaseRoot":${treePayload.serialized},"trashRoot":${trashSerialized}}`;
        return res.type("application/json").send(body);
      }

      const knowledgebaseRoot = await kbAdminService.getKnowledgebaseTree();
      const trashList = await trashService.listItems();
      return res.json({
        ok: true,
        knowledgebaseRoot,
        trashRoot: trashList.trashRoot
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/tree/status", async (_req, res, next) => {
    try {
      if (!kbAdminService || typeof kbAdminService.getTreeCacheStatus !== "function") {
        return res.status(503).json({ ok: false, message: "Tree cache status is unavailable." });
      }

      return res.json(kbAdminService.getTreeCacheStatus());
    } catch (error) {
      return next(error);
    }
  });

  router.get("/integrity/scan", async (req, res, next) => {
    try {
      if (!kbAdminService || typeof kbAdminService.scanIntegrity !== "function") {
        return res.status(503).json({ ok: false, message: "Integrity scan is unavailable." });
      }

      const force = String(req.query.force || "").toLowerCase() === "true";
      const result = await kbAdminService.scanIntegrity({ force });
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/integrity/history", async (_req, res, next) => {
    try {
      if (!kbAdminService || typeof kbAdminService.clearIntegrityHistory !== "function") {
        return res.status(503).json({ ok: false, message: "Integrity history clear is unavailable." });
      }

      const result = await kbAdminService.clearIntegrityHistory();
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/search/index/status", async (_req, res, next) => {
    try {
      if (!kbService || typeof kbService.getSearchIndexStatus !== "function") {
        return res.status(503).json({ ok: false, message: "Search index status is unavailable." });
      }

      return res.json(kbService.getSearchIndexStatus());
    } catch (error) {
      return next(error);
    }
  });

  router.post("/search/index/rebuild", async (req, res, next) => {
    try {
      if (!kbService || typeof kbService.rebuildSearchIndex !== "function") {
        return res.status(503).json({ ok: false, message: "Search index rebuild is unavailable." });
      }

      const reasonInput = req.body && req.body.reason ? String(req.body.reason).trim() : "";
      const reasonSuffix = reasonInput ? reasonInput.slice(0, 48) : "manual";
      const result = await kbService.rebuildSearchIndex(`admin-api:${reasonSuffix}`);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });
  router.post("/topic", async (req, res, next) => {
    try {
      const { name, question } = req.body || {};
      const result = await kbAdminService.createTopic(name, question);
      if (result.ok) {
        markReadCacheDirty("topic-create");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/answer", async (req, res, next) => {
    try {
      const { parentPath, answerName, kind } = req.body || {};
      const result = await kbAdminService.createAnswer(parentPath, answerName, kind);
      if (result.ok) {
        markReadCacheDirty("answer-create");
      }
      if (result.ok && kind === "solution") {
        await syncSearchIndex(() => kbService.upsertSearchIndexPath(result.path));
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/question", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const result = await kbAdminService.getQuestion(kbPath);
      return res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.put("/question", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const { question } = req.body || {};
      const result = await kbAdminService.saveQuestion(kbPath, question, req.session.user.username);
      if (result.ok) {
        markReadCacheDirty("question-save");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/solution/view", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const result = await kbAdminService.getSolutionPreview(kbPath);
      return res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/solution/images", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const result = await kbAdminService.listSolutionImages(kbPath);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/solution/images/delete", async (req, res, next) => {
    try {
      const kbPath = String((req.body && req.body.path) || "");
      const filename = String((req.body && req.body.filename) || "");

      const canApprove = isApprover(req);
      if (!canApprove) {
        return res.status(403).json({
          ok: false,
          message: "Image deletes for non-approvers must be staged and submitted for approval."
        });
      }

      const result = await kbAdminService.deleteSolutionImage(kbPath, filename);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/solution", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const username = req.session.user.username;

      const lockAttempt = await lockService.acquire(kbPath, username);
      if (!lockAttempt.ok && lockAttempt.locked) {
        return res.status(423).json({
          ok: false,
          locked: true,
          owner: lockAttempt.owner,
          expiresAt: lockAttempt.expiresAt,
          canForceUnlock: lockAttempt.canForceUnlock,
          relativeTime: lockAttempt.relativeTime
        });
      }

      if (!lockAttempt.ok) {
        return res.status(400).json(lockAttempt);
      }

      const result = await kbAdminService.getSolutionForEdit(kbPath);
      if (!result.ok) {
        return res.status(404).json(result);
      }

      let review = {
        canApprove: isApprover(req),
        settings: { flagEditsRequireApproval: false },
        status: null
      };

      if (approvalService) {
        const [statusResult, settings] = await Promise.all([
          approvalService.getSolutionStatus(result.path, username),
          getApprovalSettings()
        ]);

        review = {
          canApprove: isApprover(req),
          settings,
          status: statusResult && statusResult.ok ? statusResult.status : null
        };
      }

      return res.json({
        ok: true,
        path: result.path,
        content: result.content,
        publishedContent: result.publishedContent,
        draftContent: result.draftContent,
        draftExists: result.draftExists,
        draft: result.draft,
        review,
        lock: {
          owner: lockAttempt.owner,
          createdAt: lockAttempt.createdAt,
          expiresAt: lockAttempt.expiresAt
        },
        lockConfig: {
          heartbeatSeconds: config.locks.heartbeatSeconds,
          ttlMinutes: config.locks.solutionLockTtlMinutes
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/solution/draft", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const result = await kbAdminService.getSolutionDraft(kbPath);
      return res.status(result.ok ? 200 : 404).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/solution/draft", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const username = req.session.user.username;
      const ownership = await lockService.ensureLockOwned(kbPath, username);
      if (!ownership.ok) {
        return res.status(423).json({ ok: false, message: ownership.message });
      }

      const result = await kbAdminService.saveSolutionDraft(kbPath, username, req.body && req.body.content);
      if (result.ok) {
        markReadCacheDirty("solution-draft-save");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/solution/draft", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const username = req.session.user.username;
      const ownership = await lockService.ensureLockOwned(kbPath, username);
      if (!ownership.ok) {
        return res.status(423).json({ ok: false, message: ownership.message });
      }

      const result = await kbAdminService.discardSolutionDraft(kbPath);
      if (result.ok) {
        markReadCacheDirty("solution-draft-discard");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.put("/solution", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const username = req.session.user.username;
      const ownership = await lockService.ensureLockOwned(kbPath, username);
      if (!ownership.ok) {
        return res.status(423).json({ ok: false, message: ownership.message });
      }

      const canApprove = isApprover(req);
      const settings = await getApprovalSettings();

      if (!approvalService || canApprove) {
        const result = await kbAdminService.publishSolution(kbPath, req.body && req.body.content, username);
        if (!result.ok) {
          return res.status(400).json(result);
        }

        if (approvalService) {
          await approvalService.supersedePendingByPath(kbPath, username, "Superseded by direct publish.");
        }

        await lockService.release(kbPath, username);
        await syncSearchIndex(() => kbService.upsertSearchIndexPath(result.path));
        markReadCacheDirty("solution-publish");
        return res.json({ ok: true, path: result.path, mode: "published" });
      }

      const content = req.body && typeof req.body.content === "string"
        ? req.body.content
        : "";
      const pendingImageDeletes = normalizePendingImageDeletes(req.body && req.body.pendingImageDeletes);
      const pendingFlags = settings.flagEditsRequireApproval
        ? normalizePendingFlagNames(req.body && req.body.pendingFlags)
        : [];

      const pendingResult = await approvalService.submitOrUpdatePending({
        path: kbPath,
        submittedBy: username,
        contentHtml: content,
        imageDeletes: pendingImageDeletes,
        pendingFlags
      });

      if (!pendingResult.ok) {
        return res.status(pendingResult.blocked ? 409 : 400).json(pendingResult);
      }

      await lockService.release(kbPath, username);
      return res.json({
        ok: true,
        mode: pendingResult.mode,
        submissionId: pendingResult.submission.id,
        path: pendingResult.submission.path
      });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/solution/flags", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const { flagNames } = req.body || {};

      const canApprove = isApprover(req);
      const settings = await getApprovalSettings();
      if (!canApprove && settings.flagEditsRequireApproval) {
        return res.status(403).json({
          ok: false,
          message: "Flag edits require approval. Submit changes through the solution approval workflow."
        });
      }

      const result = await kbAdminService.updateSolutionFlags(kbPath, flagNames);
      if (result.ok) {
        await syncSearchIndex(() => kbService.upsertSearchIndexPath(kbPath));
        markReadCacheDirty("solution-flags");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/history", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const result = await kbAdminService.getVersionHistory(kbPath);
      const status = result.ok ? 200 : 404;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/history/rollback", async (req, res, next) => {
    try {
      const { path: kbPath, versionId } = req.body || {};
      const result = await kbAdminService.rollbackVersion(kbPath, versionId, req.session.user.username);
      if (result.ok) {
        markReadCacheDirty("version-rollback");
      }
      if (result.ok && result.nodeType === "solution") {
        await syncSearchIndex(() => kbService.upsertSearchIndexPath(result.path));
      }
      const status = result.ok ? 200 : 400;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/history/delete", async (req, res, next) => {
    try {
      const { path: kbPath, versionId } = req.body || {};
      const result = await kbAdminService.deleteVersion(kbPath, versionId, req.session.user.username);
      if (result.ok) {
        markReadCacheDirty("version-delete");
      }
      const status = result.ok ? 200 : 400;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/convert/solution-to-node", async (req, res, next) => {
    try {
      const { path: kbPath, question } = req.body || {};
      const result = await kbAdminService.convertSolutionToNode(kbPath, question, req.session.user.username);
      if (result.ok) {
        await syncSearchIndex(() => kbService.removeSearchIndexPathPrefix(result.path));
        markReadCacheDirty("convert-solution-to-node");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/convert/node-to-solution", async (req, res, next) => {
    try {
      const { path: kbPath, confirmDestructive } = req.body || {};
      const result = await kbAdminService.convertNodeToSolution(kbPath, Boolean(confirmDestructive), req.session.user.username);
      if (!result.ok && result.requiresConfirm) {
        return res.status(409).json(result);
      }
      if (result.ok) {
        await syncSearchIndex(() => kbService.removeSearchIndexPathPrefix(result.path));
        await syncSearchIndex(() => kbService.upsertSearchIndexPath(result.path));
        markReadCacheDirty("convert-node-to-solution");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/batch-delete", async (req, res, next) => {
    try {
      const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
      if (!items.length) {
        return res.status(400).json({ ok: false, message: "items is required." });
      }

      const normalizedItems = [];
      const seen = new Set();
      for (const item of items) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const type = String(item.type || "").trim().toLowerCase();
        let pathValue = "";
        if (type === "question" || type === "solution") {
          pathValue = String(item.path || "").trim();
        } else if (type === "answer") {
          const parentPath = String(item.path || "").trim();
          const answerKey = String(item.answerKey || "").trim();
          pathValue = parentPath && answerKey ? `${parentPath}/${answerKey}` : "";
        }

        if (!pathValue || seen.has(pathValue)) {
          continue;
        }

        seen.add(pathValue);
        normalizedItems.push({ type, path: pathValue });
      }

      if (!normalizedItems.length) {
        return res.status(400).json({ ok: false, message: "No valid items provided." });
      }

      const results = [];
      let deletedCount = 0;
      let failedCount = 0;

      for (const item of normalizedItems) {
        const deleteResult = await trashService.softDelete(item.path, true);
        if (!deleteResult.ok) {
          failedCount += 1;
          results.push({
            type: item.type,
            path: item.path,
            status: "failed",
            message: deleteResult.message || "Delete failed."
          });
          continue;
        }

        deletedCount += 1;
        results.push({
          type: item.type,
          path: item.path,
          status: "deleted",
          trashPath: deleteResult.trashPath
        });

        if (draftService) {
          await draftService.deleteDraftsByPathPrefix(item.path);
        }
        if (versionService) {
          await versionService.deleteSnapshotsByPathPrefix(item.path);
        }
        if (lockService) {
          await lockService.releaseLocksByPathPrefix(deleteResult.trashPath);
        }

        await syncSearchIndex(() => kbService.removeSearchIndexPathPrefix(item.path));
        if (approvalService) {
          await approvalService.deleteSubmissionsByPathPrefix(item.path);
        }
      }

      if (deletedCount > 0) {
        markTreeCacheDirty("batch-delete");
        markReadCacheDirty("batch-delete");
      }

      return res.status(failedCount === 0 ? 200 : 400).json({
        ok: failedCount === 0,
        deletedCount,
        failedCount,
        results
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/batch-convert", async (req, res, next) => {
    try {
      const mode = String(req.body && req.body.mode || "").trim();
      const paths = Array.isArray(req.body && req.body.paths) ? req.body.paths : [];
      const questionText = String(req.body && req.body.questionText || "New question");

      if (!["question-to-solution", "solution-to-question"].includes(mode)) {
        return res.status(400).json({ ok: false, message: "Invalid conversion mode." });
      }

      const uniquePaths = [...new Set(paths.map((entry) => String(entry || "").trim()).filter(Boolean))];
      if (!uniquePaths.length) {
        return res.status(400).json({ ok: false, message: "paths is required." });
      }

      const results = [];
      let convertedCount = 0;
      let failedCount = 0;

      for (const kbPath of uniquePaths) {
        let convertResult;
        if (mode === "question-to-solution") {
          convertResult = await kbAdminService.convertNodeToSolution(kbPath, true, req.session.user.username);
        } else {
          convertResult = await kbAdminService.convertSolutionToNode(kbPath, questionText, req.session.user.username);
        }

        if (!convertResult.ok) {
          failedCount += 1;
          results.push({
            path: kbPath,
            status: "failed",
            message: convertResult.message || "Convert failed."
          });
          continue;
        }

        convertedCount += 1;
        results.push({
          path: convertResult.path || kbPath,
          status: "converted"
        });

        if (mode === "question-to-solution") {
          await syncSearchIndex(() => kbService.removeSearchIndexPathPrefix(kbPath));
          await syncSearchIndex(() => kbService.upsertSearchIndexPath(convertResult.path || kbPath));
        } else {
          await syncSearchIndex(() => kbService.removeSearchIndexPathPrefix(kbPath));
        }
      }

      if (convertedCount > 0) {
        markReadCacheDirty("batch-convert");
      }

      return res.status(failedCount === 0 ? 200 : 400).json({
        ok: failedCount === 0,
        mode,
        convertedCount,
        failedCount,
        results
      });
    } catch (error) {
      return next(error);
    }
  });
  router.post("/lock/heartbeat", async (req, res, next) => {
    try {
      const { path: kbPath, type } = req.body || {};
      if (type !== "solution") {
        return res.status(400).json({ ok: false, message: "Only solution locks are supported." });
      }

      const result = await lockService.heartbeat(kbPath, req.session.user.username);
      return res.status(result.ok ? 200 : 423).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/lock/release", async (req, res, next) => {
    try {
      const { path: kbPath, type } = req.body || {};
      if (type !== "solution") {
        return res.status(400).json({ ok: false, message: "Only solution locks are supported." });
      }

      const result = await lockService.release(kbPath, req.session.user.username);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/lock/force-release", async (req, res, next) => {
    try {
      const { path: kbPath, type, confirm } = req.body || {};
      if (!confirm) {
        return res.status(400).json({ ok: false, message: "Force unlock requires confirm=true." });
      }
      if (type !== "solution") {
        return res.status(400).json({ ok: false, message: "Only solution locks are supported." });
      }

      const result = await lockService.forceRelease(kbPath, req.session.user.username);
      const status = result.ok ? 200 : 423;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/rename", async (req, res, next) => {
    try {
      const { path: kbPath, newName } = req.body || {};
      const result = await kbAdminService.renamePath(kbPath, newName);
      if (!result.ok) {
        return res.status(400).json(result);
      }

      let movedDrafts = 0;
      let movedVersionPaths = 0;
      const warnings = [];

      if (draftService) {
        const draftMove = await draftService.moveDraftsByPathPrefix(kbPath, result.path);
        movedDrafts = draftMove.moved || 0;
        if (!draftMove.ok) {
          warnings.push(draftMove.message || "Draft migration failed.");
        }
      }

      if (versionService) {
        const versionMove = await versionService.moveSnapshotsByPathPrefix(kbPath, result.path);
        movedVersionPaths = versionMove.moved || 0;
        if (!versionMove.ok) {
          warnings.push(versionMove.message || "Version history migration failed.");
        }
      }

      await syncSearchIndex(() => kbService.renameSearchIndexPathPrefix(kbPath, result.path));
      if (approvalService) {
        await approvalService.moveSubmissionsByPathPrefix(kbPath, result.path);
      }
      markReadCacheDirty("path-rename");

      return res.json({
        ...result,
        movedDrafts,
        movedVersionPaths,
        ...(warnings.length ? { warning: warnings.join(" ") } : {})
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/move-question", async (req, res, next) => {
    try {
      const { sourcePath, destinationParentPath } = req.body || {};
      const result = await kbAdminService.moveQuestionNode(sourcePath, destinationParentPath);
      if (!result.ok) {
        return res.status(400).json(result);
      }

      let movedDrafts = 0;
      let movedVersionPaths = 0;
      const warnings = [];

      if (draftService) {
        const draftMove = await draftService.moveDraftsByPathPrefix(result.oldPath, result.path);
        movedDrafts = draftMove.moved || 0;
        if (!draftMove.ok) {
          warnings.push(draftMove.message || "Draft migration failed.");
        }
      }

      if (versionService) {
        const versionMove = await versionService.moveSnapshotsByPathPrefix(result.oldPath, result.path);
        movedVersionPaths = versionMove.moved || 0;
        if (!versionMove.ok) {
          warnings.push(versionMove.message || "Version history migration failed.");
        }
      }

      await syncSearchIndex(() => kbService.renameSearchIndexPathPrefix(result.oldPath, result.path));
      if (approvalService) {
        await approvalService.moveSubmissionsByPathPrefix(result.oldPath, result.path);
      }
      markReadCacheDirty("path-move-question");

      return res.json({
        ...result,
        movedDrafts,
        movedVersionPaths,
        ...(warnings.length ? { warning: warnings.join(" ") } : {})
      });
    } catch (error) {
      return next(error);
    }
  });
  router.post("/delete", async (req, res, next) => {
    try {
      const { path: kbPath, confirmRecursive } = req.body || {};
      const result = await trashService.softDelete(kbPath, Boolean(confirmRecursive));
      if (!result.ok && result.requiresConfirm) {
        return res.status(409).json(result);
      }
      if (!result.ok) {
        return res.status(400).json(result);
      }

      let deletedDrafts = 0;
      let deletedVersionPaths = 0;
      let releasedLocks = 0;
      const warnings = [];

      if (draftService) {
        const draftCleanup = await draftService.deleteDraftsByPathPrefix(kbPath);
        deletedDrafts = draftCleanup.deleted || 0;
        if (!draftCleanup.ok) {
          warnings.push(draftCleanup.message || "Draft cleanup failed.");
        }
      }

      if (versionService) {
        const versionCleanup = await versionService.deleteSnapshotsByPathPrefix(kbPath);
        deletedVersionPaths = versionCleanup.deleted || 0;
        if (!versionCleanup.ok) {
          warnings.push(versionCleanup.message || "Version history cleanup failed.");
        }
      }

      const lockCleanup = await lockService.releaseLocksByPathPrefix(result.trashPath);
      releasedLocks = lockCleanup.released || 0;
      if (!lockCleanup.ok) {
        warnings.push(lockCleanup.message || "Lock cleanup failed.");
      }

      await syncSearchIndex(() => kbService.removeSearchIndexPathPrefix(kbPath));
      if (approvalService) {
        await approvalService.deleteSubmissionsByPathPrefix(kbPath);
      }
      markTreeCacheDirty("path-delete");
      markReadCacheDirty("path-delete");

      return res.json({
        ...result,
        deletedDrafts,
        deletedVersionPaths,
        releasedLocks,
        ...(warnings.length ? { warning: warnings.join(" ") } : {})
      });
    } catch (error) {
      return next(error);
    }
  });


  router.post("/trash/list", async (_req, res, next) => {
    try {
      const result = await trashService.listItems();
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/trash/restore-plan", async (req, res, next) => {
    try {
      const { trashPaths, mode, newRootPath } = req.body || {};
      const result = await trashService.restorePlan(trashPaths, mode, newRootPath);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/trash/restore-bulk", async (req, res, next) => {
    try {
      const { mode, newRootPath, entries } = req.body || {};
      const result = await trashService.restoreBulk(mode, newRootPath, entries);
      if (result.restoredCount > 0) {
        await syncSearchIndex(() => kbService.rebuildSearchIndex("trash-restore-bulk"));
        markTreeCacheDirty("trash-restore-bulk");
        markReadCacheDirty("trash-restore-bulk");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/trash/restore", async (req, res, next) => {
    try {
      const { trashPath, restoreToPath } = req.body || {};
      const result = await trashService.restore(trashPath, restoreToPath);
      if (result.ok) {
        await syncSearchIndex(() => kbService.rebuildSearchIndex("trash-restore"));
        markTreeCacheDirty("trash-restore");
        markReadCacheDirty("trash-restore");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/trash/purge-bulk", async (req, res, next) => {
    try {
      const { trashPaths, confirm } = req.body || {};
      if (!confirm) {
        return res.status(400).json({ ok: false, message: "Purge requires confirm=true." });
      }

      const result = await trashService.purgeBulk(trashPaths);
      if (result.purgedCount > 0) {
        markTreeCacheDirty("trash-purge-bulk");
        markReadCacheDirty("trash-purge-bulk");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/trash/purge", async (req, res, next) => {
    try {
      const { trashPath, confirm } = req.body || {};
      if (!confirm) {
        return res.status(400).json({ ok: false, message: "Purge requires confirm=true." });
      }

      const result = await trashService.purge(trashPath);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/upload-image", upload.single("image"), async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      if (!isApprover(req)) {
        return res.status(403).json({
          ok: false,
          message: "Non-approvers must submit inline images through solution approval."
        });
      }

      const result = await kbAdminService.saveUploadedImage(kbPath, req.file);
      if (result.ok) {
        markReadCacheDirty("image-upload");
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      if (error && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          message: "Image exceeds maximum upload size."
        });
      }
      return next(error);
    }
  });

  return router;
}

function normalizePendingImageDeletes(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .map((entry) => path.basename(entry))
    .filter(Boolean))];
}

function normalizePendingFlagNames(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input
    .map((entry) => String(entry || "").trim())
    .filter(Boolean))];
}

module.exports = {
  createAdminRouter
};

