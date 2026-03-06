const crypto = require("crypto");
const fs = require("fs/promises");
const { writeFileAtomic } = require("../utils/fs-utils");
const { normalizeKbRelativePath } = require("../utils/path-utils");
const { normalizeUsername } = require("./user-service");

const VALID_STATUSES = new Set(["pending", "approved", "rejected", "superseded", "withdrawn"]);
const DEFAULT_SETTINGS = Object.freeze({
  flagEditsRequireApproval: false
});

class ApprovalService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.filePath = config.paths.approvalsFileAbsolute;
    this.maxResolvedHistory = Math.max(100, Number(config.approvals.maxResolvedHistory) || 2000);
    this.writeQueue = Promise.resolve();
  }

  async getSettings() {
    const doc = await this.#readDocument();
    return {
      ok: true,
      settings: { ...doc.settings }
    };
  }

  async saveSettings(input) {
    const payload = input && typeof input === "object" ? input : {};
    if (typeof payload.flagEditsRequireApproval !== "boolean") {
      return { ok: false, message: "flagEditsRequireApproval must be a boolean." };
    }

    let settings = null;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      doc.settings.flagEditsRequireApproval = payload.flagEditsRequireApproval;
      settings = { ...doc.settings };
      await this.#writeDocument(doc);
    });

    this.logger.info("Approval settings updated", {
      event: "approval_settings_update",
      flagEditsRequireApproval: settings.flagEditsRequireApproval
    });

    return {
      ok: true,
      settings
    };
  }

  async isFlagApprovalRequired() {
    const settings = await this.getSettings();
    return Boolean(settings.settings.flagEditsRequireApproval);
  }

  async listPending(limitInput = 200) {
    const limit = normalizeLimit(limitInput, 1, 500, 200);
    const doc = await this.#readDocument();
    const submissions = doc.submissions
      .filter((entry) => entry.status === "pending")
      .sort(compareByUpdatedAtDesc)
      .slice(0, limit)
      .map((entry) => toSubmissionSummary(entry));

    return {
      ok: true,
      submissions
    };
  }

  async listMine(usernameInput, options = {}) {
    const username = normalizeUsername(usernameInput);
    if (!username) {
      return { ok: false, message: "Username is required." };
    }

    const requestedStatuses = String(options.statuses || "")
      .split(",")
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    const statuses = requestedStatuses.length
      ? requestedStatuses.filter((value) => VALID_STATUSES.has(value))
      : ["pending", "rejected"];

    const limit = normalizeLimit(options.limit, 1, 500, 100);
    const statusSet = new Set(statuses);
    const doc = await this.#readDocument();

    const submissions = doc.submissions
      .filter((entry) => normalizeUsername(entry.submittedBy) === username)
      .filter((entry) => statusSet.has(entry.status))
      .sort(compareByUpdatedAtDesc)
      .slice(0, limit)
      .map((entry) => toSubmissionSummary(entry));

    return {
      ok: true,
      submissions
    };
  }

  async getSubmissionById(submissionIdInput, options = {}) {
    const submissionId = String(submissionIdInput || "").trim();
    if (!submissionId) {
      return null;
    }

    const includeContent = options.includeContent !== false;
    const doc = await this.#readDocument();
    const found = doc.submissions.find((entry) => entry.id === submissionId);
    if (!found) {
      return null;
    }

    return includeContent ? { ...found } : toSubmissionSummary(found);
  }

  async getPendingForPath(pathInput) {
    const kbPath = normalizeApprovalPath(pathInput);
    if (!kbPath) {
      return null;
    }

    const doc = await this.#readDocument();
    const found = doc.submissions.find((entry) => entry.path === kbPath && entry.status === "pending");
    return found ? { ...found } : null;
  }

  async getSolutionStatus(pathInput, usernameInput) {
    const kbPath = normalizeApprovalPath(pathInput);
    const username = normalizeUsername(usernameInput);
    if (!kbPath || !username) {
      return {
        ok: false,
        message: "Path and username are required."
      };
    }

    const doc = await this.#readDocument();
    const entries = doc.submissions.filter((entry) => entry.path === kbPath);
    const ownEntries = entries
      .filter((entry) => normalizeUsername(entry.submittedBy) === username)
      .sort(compareByUpdatedAtDesc);

    const ownPending = ownEntries.find((entry) => entry.status === "pending") || null;
    const ownRejected = ownEntries.find((entry) => entry.status === "rejected") || null;
    const activePending = entries.find((entry) => entry.status === "pending") || null;

    return {
      ok: true,
      status: {
        path: kbPath,
        ownPending: ownPending ? { ...ownPending } : null,
        ownRejected: ownRejected ? { ...ownRejected } : null,
        activePending: activePending ? toSubmissionSummary(activePending) : null,
        blockedByOtherUser: Boolean(
          activePending && normalizeUsername(activePending.submittedBy) !== username
        )
      }
    };
  }

  async submitOrUpdatePending(input) {
    const payload = input && typeof input === "object" ? input : {};
    const pathValue = normalizeApprovalPath(payload.path);
    const submittedBy = normalizeUsername(payload.submittedBy);
    const contentHtml = String(payload.contentHtml || "");

    if (!pathValue) {
      return { ok: false, message: "Path is required." };
    }
    if (!submittedBy) {
      return { ok: false, message: "Submitted user is required." };
    }

    const imageDeletes = normalizeDeleteList(payload.imageDeletes);
    const pendingFlags = normalizeFlagList(payload.pendingFlags);

    let result = null;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      const existingPending = doc.submissions.find((entry) => entry.path === pathValue && entry.status === "pending");
      const now = new Date().toISOString();

      if (existingPending && normalizeUsername(existingPending.submittedBy) !== submittedBy) {
        result = {
          ok: false,
          message: `A pending submission already exists for ${pathValue} by ${existingPending.submittedBy}.`,
          pendingOwner: existingPending.submittedBy,
          blocked: true
        };
        return;
      }

      if (existingPending) {
        existingPending.contentHtml = contentHtml;
        existingPending.imageDeletes = imageDeletes;
        existingPending.pendingFlags = pendingFlags;
        existingPending.updatedAt = now;
        existingPending.reviewedBy = null;
        existingPending.reviewedAt = null;
        existingPending.reviewReason = "";

        result = {
          ok: true,
          mode: "pending-updated",
          submission: toSubmissionSummary(existingPending)
        };
      } else {
        const created = {
          id: buildSubmissionId(),
          path: pathValue,
          status: "pending",
          submittedBy,
          submittedAt: now,
          updatedAt: now,
          contentHtml,
          imageDeletes,
          pendingFlags,
          reviewedBy: null,
          reviewedAt: null,
          reviewReason: ""
        };
        doc.submissions.push(created);
        result = {
          ok: true,
          mode: "pending-submitted",
          submission: toSubmissionSummary(created)
        };
      }

      pruneResolvedSubmissions(doc.submissions, this.maxResolvedHistory);
      await this.#writeDocument(doc);
    });

    if (result && result.ok) {
      this.logger.info("Pending solution submission saved", {
        event: "approval_submit",
        path: result.submission.path,
        submissionId: result.submission.id,
        mode: result.mode,
        submittedBy
      });
    }

    return result || { ok: false, message: "Unable to submit for approval." };
  }

  async approveSubmission(input) {
    return this.#transitionSubmission(input, {
      expectedStatus: "pending",
      nextStatus: "approved",
      requireReason: false,
      defaultReason: "Approved"
    });
  }

  async rejectSubmission(input) {
    return this.#transitionSubmission(input, {
      expectedStatus: "pending",
      nextStatus: "rejected",
      requireReason: true,
      defaultReason: "Rejected"
    });
  }

  async withdrawSubmission(input) {
    const payload = input && typeof input === "object" ? input : {};
    const username = normalizeUsername(payload.username);
    const submissionId = String(payload.submissionId || "").trim();
    if (!username || !submissionId) {
      return { ok: false, message: "submissionId and username are required." };
    }

    let result = null;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      const found = doc.submissions.find((entry) => entry.id === submissionId);
      if (!found) {
        result = { ok: false, statusCode: 404, message: "Submission not found." };
        return;
      }

      if (found.status !== "pending") {
        result = { ok: false, statusCode: 409, message: "Only pending submissions can be withdrawn." };
        return;
      }

      if (normalizeUsername(found.submittedBy) !== username) {
        result = { ok: false, statusCode: 403, message: "Only the submitter can withdraw this submission." };
        return;
      }

      const now = new Date().toISOString();
      found.status = "withdrawn";
      found.updatedAt = now;
      found.reviewedBy = username;
      found.reviewedAt = now;
      found.reviewReason = "Withdrawn by submitter.";

      pruneResolvedSubmissions(doc.submissions, this.maxResolvedHistory);
      await this.#writeDocument(doc);

      result = {
        ok: true,
        submission: toSubmissionSummary(found)
      };
    });

    if (result && result.ok) {
      this.logger.info("Submission withdrawn", {
        event: "approval_withdraw",
        path: result.submission.path,
        submissionId: result.submission.id,
        actor: username
      });
    }

    return result || { ok: false, message: "Unable to withdraw submission." };
  }

  async supersedePendingByPath(pathInput, reviewerInput, reasonInput = "Superseded by direct publish.") {
    const pathValue = normalizeApprovalPath(pathInput);
    const reviewer = normalizeUsername(reviewerInput);
    if (!pathValue) {
      return { ok: false, message: "Path is required." };
    }

    let superseded = null;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      const found = doc.submissions.find((entry) => entry.path === pathValue && entry.status === "pending");
      if (!found) {
        superseded = null;
        return;
      }

      const now = new Date().toISOString();
      found.status = "superseded";
      found.updatedAt = now;
      found.reviewedBy = reviewer || "system";
      found.reviewedAt = now;
      found.reviewReason = normalizeReason(reasonInput, "Superseded by direct publish.");
      superseded = toSubmissionSummary(found);

      pruneResolvedSubmissions(doc.submissions, this.maxResolvedHistory);
      await this.#writeDocument(doc);
    });

    if (!superseded) {
      return { ok: true, superseded: false };
    }

    return {
      ok: true,
      superseded: true,
      submission: superseded
    };
  }

  async moveSubmissionsByPathPrefix(oldPathInput, newPathInput) {
    const oldPrefix = normalizeApprovalPath(oldPathInput);
    const newPrefix = normalizeApprovalPath(newPathInput);
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
      return { ok: true, moved: 0 };
    }

    let moved = 0;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      for (const entry of doc.submissions) {
        if (!matchesPathPrefix(entry.path, oldPrefix)) {
          continue;
        }

        const suffix = entry.path === oldPrefix ? "" : entry.path.slice(oldPrefix.length + 1);
        entry.path = suffix ? `${newPrefix}/${suffix}` : newPrefix;
        entry.updatedAt = new Date().toISOString();
        moved += 1;
      }

      if (moved > 0) {
        await this.#writeDocument(doc);
      }
    });

    return { ok: true, moved };
  }

  async deleteSubmissionsByPathPrefix(pathInput) {
    const prefix = normalizeApprovalPath(pathInput);
    if (!prefix) {
      return { ok: true, deleted: 0 };
    }

    let deleted = 0;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      const before = doc.submissions.length;
      doc.submissions = doc.submissions.filter((entry) => !matchesPathPrefix(entry.path, prefix));
      deleted = before - doc.submissions.length;
      if (deleted > 0) {
        await this.#writeDocument(doc);
      }
    });

    return { ok: true, deleted };
  }

  async deletePendingSubmissionsByUser(usernameInput) {
    const username = normalizeUsername(usernameInput);
    if (!username) {
      return { ok: true, deleted: 0 };
    }

    let deleted = 0;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      const before = doc.submissions.length;
      doc.submissions = doc.submissions.filter((entry) => {
        if (entry.status !== "pending") {
          return true;
        }
        return normalizeUsername(entry.submittedBy) !== username;
      });
      deleted = before - doc.submissions.length;
      if (deleted > 0) {
        await this.#writeDocument(doc);
      }
    });

    return { ok: true, deleted };
  }

  async #transitionSubmission(input, options) {
    const payload = input && typeof input === "object" ? input : {};
    const reviewer = normalizeUsername(payload.reviewer);
    const submissionId = String(payload.submissionId || "").trim();
    const reason = normalizeReason(payload.reason, options.defaultReason);
    if (!reviewer || !submissionId) {
      return { ok: false, message: "submissionId and reviewer are required." };
    }

    if (options.requireReason && !String(payload.reason || "").trim()) {
      return { ok: false, message: "Reason is required." };
    }

    let result = null;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      const found = doc.submissions.find((entry) => entry.id === submissionId);
      if (!found) {
        result = { ok: false, statusCode: 404, message: "Submission not found." };
        return;
      }

      if (found.status !== options.expectedStatus) {
        result = {
          ok: false,
          statusCode: 409,
          message: `Submission is ${found.status}, expected ${options.expectedStatus}.`
        };
        return;
      }

      const now = new Date().toISOString();
      found.status = options.nextStatus;
      found.updatedAt = now;
      found.reviewedBy = reviewer;
      found.reviewedAt = now;
      found.reviewReason = reason;

      pruneResolvedSubmissions(doc.submissions, this.maxResolvedHistory);
      await this.#writeDocument(doc);

      result = {
        ok: true,
        submission: toSubmissionSummary(found)
      };
    });

    if (result && result.ok) {
      const nextStatus = String(options.nextStatus || "").trim().toLowerCase();
      const event = nextStatus === "approved"
        ? "approval_approve"
        : nextStatus === "rejected"
          ? "approval_reject"
          : "approval_transition";
      this.logger.info("Submission status transitioned", {
        event,
        path: result.submission.path,
        submissionId: result.submission.id,
        status: result.submission.status,
        actor: reviewer,
        reason
      });
    }

    return result || { ok: false, message: "Unable to transition submission." };
  }

  async #readDocument() {
    const raw = await fs.readFile(this.filePath, "utf8").catch(() => "");
    if (!raw.trim()) {
      return createDefaultDocument();
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizeDocument(parsed);
    } catch {
      return createDefaultDocument();
    }
  }

  async #writeDocument(docInput) {
    const doc = normalizeDocument(docInput);
    await writeFileAtomic(this.filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  async #withWriteLock(task) {
    const previous = this.writeQueue;
    let release;
    this.writeQueue = new Promise((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }
}

function createDefaultDocument() {
  return {
    version: 1,
    settings: {
      ...DEFAULT_SETTINGS
    },
    submissions: []
  };
}

function normalizeDocument(input) {
  const source = input && typeof input === "object" ? input : {};
  const settingsSource = source.settings && typeof source.settings === "object"
    ? source.settings
    : {};

  const settings = {
    flagEditsRequireApproval: typeof settingsSource.flagEditsRequireApproval === "boolean"
      ? settingsSource.flagEditsRequireApproval
      : DEFAULT_SETTINGS.flagEditsRequireApproval
  };

  const submissions = Array.isArray(source.submissions)
    ? source.submissions.map(normalizeSubmission).filter(Boolean)
    : [];

  return {
    version: 1,
    settings,
    submissions
  };
}

function normalizeSubmission(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const id = String(input.id || "").trim();
  const path = normalizeApprovalPath(input.path);
  const status = normalizeStatus(input.status);
  const submittedBy = normalizeUsername(input.submittedBy);
  if (!id || !path || !submittedBy) {
    return null;
  }

  const submittedAt = toIsoOrNow(input.submittedAt);
  const updatedAt = toIsoOrNow(input.updatedAt || input.submittedAt);
  const reviewedBy = normalizeUsername(input.reviewedBy) || null;
  const reviewedAt = input.reviewedAt ? toIsoOrNow(input.reviewedAt) : null;

  return {
    id,
    path,
    status,
    submittedBy,
    submittedAt,
    updatedAt,
    contentHtml: String(input.contentHtml || ""),
    imageDeletes: normalizeDeleteList(input.imageDeletes),
    pendingFlags: normalizeFlagList(input.pendingFlags),
    reviewedBy,
    reviewedAt,
    reviewReason: String(input.reviewReason || "").trim()
  };
}

function normalizeStatus(value) {
  const status = String(value || "pending").trim().toLowerCase();
  if (VALID_STATUSES.has(status)) {
    return status;
  }
  return "pending";
}

function normalizeApprovalPath(pathInput) {
  const normalized = normalizeKbRelativePath(pathInput);
  if (!normalized || normalized.includes("..")) {
    return "";
  }
  return normalized;
}

function normalizeDeleteList(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^.*[\\/]/, ""))
    .filter(Boolean))];
}

function normalizeFlagList(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list
    .map((entry) => String(entry || "").trim())
    .filter(Boolean))];
}

function toSubmissionSummary(entry) {
  return {
    id: entry.id,
    path: entry.path,
    status: entry.status,
    submittedBy: entry.submittedBy,
    submittedAt: entry.submittedAt,
    updatedAt: entry.updatedAt,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt,
    reviewReason: entry.reviewReason,
    imageDeletesCount: Array.isArray(entry.imageDeletes) ? entry.imageDeletes.length : 0,
    pendingFlagsCount: Array.isArray(entry.pendingFlags) ? entry.pendingFlags.length : 0,
    imageDeletes: Array.isArray(entry.imageDeletes) ? [...entry.imageDeletes] : [],
    pendingFlags: Array.isArray(entry.pendingFlags) ? [...entry.pendingFlags] : []
  };
}

function pruneResolvedSubmissions(submissions, maxResolvedHistory) {
  if (!Array.isArray(submissions)) {
    return;
  }

  const pending = [];
  const resolved = [];
  for (const entry of submissions) {
    if (entry.status === "pending") {
      pending.push(entry);
    } else {
      resolved.push(entry);
    }
  }

  resolved.sort(compareByUpdatedAtDesc);
  const keptResolved = resolved.slice(0, maxResolvedHistory);

  submissions.length = 0;
  submissions.push(...pending, ...keptResolved);
}

function compareByUpdatedAtDesc(a, b) {
  const aTime = Date.parse(a.updatedAt || a.submittedAt || 0);
  const bTime = Date.parse(b.updatedAt || b.submittedAt || 0);
  return bTime - aTime;
}

function normalizeReason(reasonInput, fallback) {
  const reason = String(reasonInput || "").trim();
  if (reason) {
    return reason;
  }
  return String(fallback || "").trim();
}

function toIsoOrNow(value) {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function buildSubmissionId() {
  return `apr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeLimit(valueInput, min, max, fallback) {
  const parsed = Number.parseInt(valueInput, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function matchesPathPrefix(candidate, prefix) {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

module.exports = {
  ApprovalService
};
