const express = require("express");
const path = require("path");
const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");
const { requireApprover } = require("../middleware/require-approver");
const { createAdminWriteRateLimiter } = require("../middleware/rate-limit");

const DATA_URL_PATTERN = /^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
const IMG_SRC_ATTR_PATTERN = /src\s*=\s*(["'])([^"']+)\1/gi;

function createReviewsRouter({ config, approvalService, lockService, kbAdminService, kbService }) {
  const router = express.Router();
  router.use(requireAuth(), requireRole(["admin", "superadmin"]));
  router.use(createAdminWriteRateLimiter(config));

  const syncSearchIndex = async (mutation) => {
    if (!kbService || typeof mutation !== "function") {
      return;
    }

    try {
      await mutation();
    } catch {
      if (typeof kbService.markSearchIndexDirty === "function") {
        kbService.markSearchIndexDirty("review-mutation-sync-failed");
      }
    }
  };

  const markReadCacheDirty = (reason) => {
    if (kbService && typeof kbService.markReadCacheDirty === "function") {
      kbService.markReadCacheDirty(reason);
    }
  };

  const markTreeCacheDirty = (reason) => {
    if (kbAdminService && typeof kbAdminService.markTreeCacheDirty === "function") {
      kbAdminService.markTreeCacheDirty(reason);
    }
  };

  router.get("/settings", async (req, res, next) => {
    try {
      const settingsResult = await approvalService.getSettings();
      return res.json({
        ok: true,
        isApprover: Boolean(req.auth && req.auth.user && req.auth.user.canApprove),
        settings: settingsResult.settings
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/mine", async (req, res, next) => {
    try {
      const statuses = String(req.query.status || "").trim();
      const limit = req.query.limit;
      const result = await approvalService.listMine(req.session.user.username, { statuses, limit });
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/mine/:id", async (req, res, next) => {
    try {
      const submission = await approvalService.getSubmissionById(req.params.id, { includeContent: true });
      if (!submission) {
        return res.status(404).json({ ok: false, message: "Submission not found." });
      }

      const currentUser = String(req.session.user.username || "").trim().toLowerCase();
      const submittedBy = String(submission.submittedBy || "").trim().toLowerCase();
      const canApprove = Boolean(req.auth && req.auth.user && req.auth.user.canApprove);
      if (!canApprove && currentUser !== submittedBy) {
        return res.status(403).json({ ok: false, message: "Not authorized to view this submission." });
      }

      const live = await kbAdminService.getSolutionPreview(submission.path);
      return res.json({
        ok: true,
        submission,
        publishedContent: live && live.ok ? String(live.solutionHtml || "") : ""
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/solution-status", async (req, res, next) => {
    try {
      const kbPath = String(req.query.path || "");
      const statusResult = await approvalService.getSolutionStatus(kbPath, req.session.user.username);
      if (!statusResult.ok) {
        return res.status(400).json(statusResult);
      }

      const settingsResult = await approvalService.getSettings();
      return res.json({
        ok: true,
        status: statusResult.status,
        settings: settingsResult.settings,
        isApprover: Boolean(req.auth && req.auth.user && req.auth.user.canApprove)
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/submissions/:id/withdraw", async (req, res, next) => {
    try {
      const result = await approvalService.withdrawSubmission({
        submissionId: req.params.id,
        username: req.session.user.username
      });

      const status = result.ok ? 200 : result.statusCode || 400;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/pending", requireApprover(), async (req, res, next) => {
    try {
      const result = await approvalService.listPending(req.query.limit);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/submissions/:id", requireApprover(), async (req, res, next) => {
    try {
      const submission = await approvalService.getSubmissionById(req.params.id, { includeContent: true });
      if (!submission) {
        return res.status(404).json({ ok: false, message: "Submission not found." });
      }

      const live = await kbAdminService.getSolutionPreview(submission.path);
      return res.json({
        ok: true,
        submission,
        publishedContent: live && live.ok ? String(live.solutionHtml || "") : ""
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/submissions/:id/reject", requireApprover(), async (req, res, next) => {
    try {
      const reason = String((req.body && req.body.reason) || "").trim();
      const result = await approvalService.rejectSubmission({
        submissionId: req.params.id,
        reviewer: req.session.user.username,
        reason
      });
      const status = result.ok ? 200 : result.statusCode || 400;
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/submissions/:id/approve", requireApprover(), async (req, res, next) => {
    let lockAcquired = false;
    let submission = null;
    try {
      submission = await approvalService.getSubmissionById(req.params.id, { includeContent: true });
      if (!submission) {
        return res.status(404).json({ ok: false, message: "Submission not found." });
      }

      if (submission.status !== "pending") {
        return res.status(409).json({ ok: false, message: `Submission is ${submission.status}, expected pending.` });
      }

      const reviewer = req.session.user.username;
      const lockResult = await lockService.acquire(submission.path, reviewer);
      if (!lockResult.ok && lockResult.locked) {
        return res.status(423).json({
          ok: false,
          locked: true,
          owner: lockResult.owner,
          expiresAt: lockResult.expiresAt,
          canForceUnlock: lockResult.canForceUnlock,
          relativeTime: lockResult.relativeTime
        });
      }

      if (!lockResult.ok) {
        return res.status(400).json(lockResult);
      }

      lockAcquired = true;

      const materialized = await materializeInlineImagesForApproval({
        kbPath: submission.path,
        contentHtml: submission.contentHtml,
        kbAdminService,
        config
      });

      if (!materialized.ok) {
        return res.status(400).json(materialized);
      }

      const publishResult = await kbAdminService.publishSolution(
        submission.path,
        materialized.content,
        reviewer
      );
      if (!publishResult.ok) {
        return res.status(400).json(publishResult);
      }

      const settingsResult = await approvalService.getSettings();
      let flagResult = null;
      if (settingsResult.settings.flagEditsRequireApproval && Array.isArray(submission.pendingFlags) && submission.pendingFlags.length > 0) {
        flagResult = await kbAdminService.updateSolutionFlags(submission.path, submission.pendingFlags);
      }

      if (flagResult && !flagResult.ok) {
        return res.status(400).json(flagResult);
      }

      const imageDeleteResult = await applyStagedImageDeletes({
        kbPath: submission.path,
        htmlContent: materialized.content,
        requestedDeletes: submission.imageDeletes,
        kbAdminService
      });

      const approvalResult = await approvalService.approveSubmission({
        submissionId: submission.id,
        reviewer,
        reason: imageDeleteResult.skipped.length
          ? `Approved with ${imageDeleteResult.skipped.length} skipped image delete(s).`
          : "Approved"
      });

      if (!approvalResult.ok) {
        return res.status(approvalResult.statusCode || 400).json(approvalResult);
      }

      await syncSearchIndex(() => kbService.upsertSearchIndexPath(submission.path));
      markReadCacheDirty("review-approve");
      markTreeCacheDirty("review-approve");

      return res.json({
        ok: true,
        submission: approvalResult.submission,
        materializedImages: materialized.converted,
        deletedImages: imageDeleteResult.deleted,
        skippedImageDeletes: imageDeleteResult.skipped
      });
    } catch (error) {
      return next(error);
    } finally {
      if (lockAcquired && submission) {
        await lockService.release(submission.path, req.session.user.username).catch(() => {});
      }
    }
  });

  return router;
}

async function materializeInlineImagesForApproval({ kbPath, contentHtml, kbAdminService, config }) {
  const html = String(contentHtml || "");
  const matches = [...html.matchAll(IMG_SRC_ATTR_PATTERN)]
    .filter((match) => match && match[2] && match[2].startsWith("data:image/"));

  if (!matches.length) {
    return { ok: true, content: html, converted: 0 };
  }

  let totalBytes = 0;
  const replacements = [];

  for (let idx = 0; idx < matches.length; idx += 1) {
    const match = matches[idx];
    const dataUrl = String(match[2] || "");
    const parsed = parseInlineDataUrl(dataUrl);
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }

    if (parsed.bytes > config.approvals.maxInlineImageBytes) {
      return {
        ok: false,
        message: `Inline image exceeds maximum size (${config.approvals.maxInlineImageBytes} bytes).`
      };
    }

    totalBytes += parsed.bytes;
    if (totalBytes > config.approvals.maxInlineTotalBytes) {
      return {
        ok: false,
        message: `Total inline image payload exceeds ${config.approvals.maxInlineTotalBytes} bytes.`
      };
    }

    const upload = await kbAdminService.saveUploadedImage(kbPath, {
      originalname: `approval-inline-${Date.now()}-${idx}.${parsed.extension}`,
      buffer: parsed.buffer
    });

    if (!upload.ok) {
      return { ok: false, message: upload.message || "Unable to store inline image." };
    }

    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      replacement: `src=${match[1]}${buildKbAssetUrl(upload.relativePath)}${match[1]}`
    });
  }

  let cursor = 0;
  let output = "";
  for (const entry of replacements.sort((a, b) => a.start - b.start)) {
    output += html.slice(cursor, entry.start);
    output += entry.replacement;
    cursor = entry.end;
  }
  output += html.slice(cursor);

  return {
    ok: true,
    content: output,
    converted: replacements.length
  };
}

function parseInlineDataUrl(dataUrl) {
  const normalized = String(dataUrl || "").trim();
  const match = DATA_URL_PATTERN.exec(normalized);
  if (!match) {
    return { ok: false, message: "Invalid inline image format." };
  }

  const extension = normalizeImageExtension(match[1]);
  if (!extension) {
    return { ok: false, message: "Unsupported inline image type." };
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    return { ok: false, message: "Inline image payload is empty." };
  }

  return {
    ok: true,
    extension,
    buffer,
    bytes: buffer.length
  };
}

function normalizeImageExtension(subtypeInput) {
  const subtype = String(subtypeInput || "").trim().toLowerCase();
  if (!subtype) {
    return "";
  }

  if (subtype === "jpeg" || subtype === "pjpeg") {
    return "jpg";
  }

  if (subtype === "jpg" || subtype === "png" || subtype === "gif" || subtype === "webp") {
    return subtype;
  }

  return "";
}

async function applyStagedImageDeletes({ kbPath, htmlContent, requestedDeletes, kbAdminService }) {
  const requested = Array.isArray(requestedDeletes)
    ? [...new Set(requestedDeletes.map((entry) => path.basename(String(entry || "").trim())).filter(Boolean))]
    : [];

  if (!requested.length) {
    return { ok: true, deleted: [], skipped: [] };
  }

  const referenced = collectReferencedImageFilenames(htmlContent);
  const deleted = [];
  const skipped = [];

  for (const filename of requested) {
    if (referenced.has(filename)) {
      skipped.push({ filename, reason: "Still referenced in approved content." });
      continue;
    }

    const result = await kbAdminService.deleteSolutionImage(kbPath, filename);
    if (!result.ok) {
      skipped.push({ filename, reason: result.message || "Delete failed." });
      continue;
    }

    deleted.push(filename);
  }

  return {
    ok: true,
    deleted,
    skipped
  };
}

function collectReferencedImageFilenames(htmlInput) {
  const html = String(htmlInput || "");
  const matches = [...html.matchAll(IMG_SRC_ATTR_PATTERN)];
  const names = new Set();

  for (const match of matches) {
    const rawSrc = String(match[2] || "").trim();
    if (!rawSrc || rawSrc.startsWith("data:")) {
      continue;
    }

    let srcValue = rawSrc;
    if (srcValue.includes("?")) {
      srcValue = srcValue.split("?")[0];
    }

    if (srcValue.includes("#")) {
      srcValue = srcValue.split("#")[0];
    }

    if (srcValue.startsWith("/api/asset/")) {
      const relative = decodeURIComponent(srcValue.slice("/api/asset/".length));
      const filename = path.basename(relative);
      if (filename) {
        names.add(filename);
      }
      continue;
    }

    const filename = path.basename(srcValue);
    if (filename) {
      names.add(filename);
    }
  }

  return names;
}

function buildKbAssetUrl(relativePathInput) {
  const cleaned = String(relativePathInput || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");

  const encoded = cleaned
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/asset/${encoded}`;
}

module.exports = {
  createReviewsRouter
};
