const fs = require("fs/promises");
const path = require("path");
const { normalizeKbRelativePath, resolveKbPath } = require("../utils/path-utils");

const RESTORE_MODES = new Set(["original", "new-root"]);
const RESTORE_ACTIONS = new Set(["restore", "skip", "auto-rename"]);

class TrashService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.kbRoot = config.paths.kbRootAbsolute;
    this.trashRoot = config.paths.kbTrashRootAbsolute;
    this.retentionDays = config.trash.retentionDays;

    this.trashTreeCache = null;
    this.trashTreeCacheDirty = true;
    this.trashTreeRebuildPromise = null;
    this.trashTreeVersion = 0;
    this.trashTreeSerialized = null;
    this.trashTreeSerializedVersion = -1;
  }

  async softDelete(pathInput, confirmRecursive) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath || normalizedPath === "_trash" || normalizedPath.startsWith("_trash/")) {
      return { ok: false, message: "Invalid delete path." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const stats = await fs.stat(resolved.absolute).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      return { ok: false, message: "Path not found." };
    }

    const entries = await fs.readdir(resolved.absolute).catch(() => []);
    const nonEmpty = entries.length > 0;
    if (nonEmpty && !confirmRecursive) {
      return {
        ok: false,
        requiresConfirm: true,
        message: "Folder is not empty. Confirm recursive delete."
      };
    }

    const timestamp = buildTimestamp();
    const destination = path.join(this.trashRoot, timestamp, normalizedPath);
    const destinationParent = path.dirname(destination);
    await fs.mkdir(destinationParent, { recursive: true });

    const collision = await fs
      .access(destination)
      .then(() => true)
      .catch(() => false);
    if (collision) {
      return { ok: false, message: "Trash collision occurred. Please retry." };
    }

    await fs.rename(resolved.absolute, destination);

    const trashPath = normalizeKbRelativePath(path.relative(this.kbRoot, destination));
    this.#markTrashCacheDirty("soft-delete");

    this.logger.info("Path soft-deleted", {
      event: "kb_delete",
      path: normalizedPath,
      trashPath
    });

    return { ok: true, trashPath };
  }

  async listItems() {
    if (this.trashTreeCache && !this.trashTreeCacheDirty) {
      return {
        ok: true,
        trashRoot: this.trashTreeCache
      };
    }

    if (this.trashTreeRebuildPromise) {
      await this.trashTreeRebuildPromise;
      return {
        ok: true,
        trashRoot: this.trashTreeCache || this.#emptyTrashRoot()
      };
    }

    const startVersion = this.trashTreeVersion;
    this.trashTreeRebuildPromise = this.#rebuildTrashTreeCacheUnlocked(startVersion)
      .finally(() => {
        this.trashTreeRebuildPromise = null;
      });

    await this.trashTreeRebuildPromise;
    return {
      ok: true,
      trashRoot: this.trashTreeCache || this.#emptyTrashRoot()
    };
  }

  async getTrashRootSerialized() {
    const result = await this.listItems();
    const trashRoot = result.trashRoot || this.#emptyTrashRoot();
    const version = this.trashTreeVersion;

    if (!this.trashTreeSerialized || this.trashTreeSerializedVersion !== version) {
      this.trashTreeSerialized = JSON.stringify(trashRoot);
      this.trashTreeSerializedVersion = version;
    }

    return {
      ok: true,
      serialized: this.trashTreeSerialized,
      version,
      dirty: this.trashTreeCacheDirty,
      trashRoot
    };
  }

  async restorePlan(trashPathsInput, modeInput, newRootPathInput) {
    const mode = normalizeRestoreMode(modeInput);
    if (!mode) {
      return { ok: false, message: "Invalid restore mode." };
    }

    const trashPaths = normalizeTrashPathArray(trashPathsInput);
    if (!trashPaths.length) {
      return { ok: false, message: "At least one trash path is required." };
    }

    const normalizedNewRootPath = mode === "new-root"
      ? normalizeKbRelativePath(newRootPathInput || "")
      : "";

    if (normalizedNewRootPath.startsWith("_trash")) {
      return { ok: false, message: "Cannot restore into trash." };
    }

    const rows = [];
    for (const trashPath of trashPaths) {
      const parsed = parseTrashPath(trashPath);
      if (!parsed.ok) {
        return parsed;
      }

      const sourceResolved = resolveKbPath(this.kbRoot, trashPath);
      if (!isSubPath(this.trashRoot, sourceResolved.absolute)) {
        return { ok: false, message: `Invalid trash path: ${trashPath}` };
      }

      const sourceStats = await fs.stat(sourceResolved.absolute).catch(() => null);
      if (!sourceStats || !sourceStats.isDirectory()) {
        return { ok: false, message: `Trash item not found: ${trashPath}` };
      }

      const targetPath = mode === "original"
        ? parsed.originalPath
        : normalizeKbRelativePath(`${normalizedNewRootPath}/${parsed.originalPath}`);

      if (!targetPath) {
        return { ok: false, message: `Unable to compute restore target for ${trashPath}.` };
      }

      const targetResolved = resolveKbPath(this.kbRoot, targetPath);
      if (isSubPath(this.trashRoot, targetResolved.absolute)) {
        return { ok: false, message: "Cannot restore into trash." };
      }

      const conflictStats = await fs.stat(targetResolved.absolute).catch(() => null);
      const conflict = {
        exists: Boolean(conflictStats),
        type: conflictStats ? (conflictStats.isDirectory() ? "directory" : "file") : null
      };

      rows.push({
        trashPath,
        itemName: path.basename(parsed.originalPath),
        originalPath: parsed.originalPath,
        targetPath,
        conflict,
        allowedActions: ["restore", "skip", "auto-rename"],
        defaultAction: "restore"
      });
    }

    return {
      ok: true,
      mode,
      newRootPath: normalizedNewRootPath,
      rows
    };
  }

  async restoreBulk(modeInput, newRootPathInput, entriesInput) {
    const mode = normalizeRestoreMode(modeInput);
    if (!mode) {
      return { ok: false, message: "Invalid restore mode." };
    }

    const entries = normalizeRestoreEntries(entriesInput);
    if (!entries.length) {
      return { ok: false, message: "At least one restore entry is required." };
    }

    const plan = await this.restorePlan(
      entries.map((entry) => entry.trashPath),
      mode,
      newRootPathInput
    );
    if (!plan.ok) {
      return plan;
    }

    const rowByTrashPath = new Map(plan.rows.map((row) => [row.trashPath, row]));
    const results = [];
    const restoredPaths = [];
    let restoredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const entry of entries) {
      const row = rowByTrashPath.get(entry.trashPath);
      if (!row) {
        failedCount += 1;
        results.push({
          trashPath: entry.trashPath,
          action: entry.action,
          status: "failed",
          message: "Restore plan row not found."
        });
        continue;
      }

      const action = normalizeRestoreAction(entry.action);
      if (!action) {
        failedCount += 1;
        results.push({
          trashPath: row.trashPath,
          action: entry.action,
          status: "failed",
          message: "Invalid restore action."
        });
        continue;
      }

      if (action === "skip") {
        skippedCount += 1;
        results.push({
          trashPath: row.trashPath,
          action,
          status: "skipped"
        });
        continue;
      }

      let resolvedTargetPath = row.targetPath;
      if (row.conflict.exists && action === "auto-rename") {
        resolvedTargetPath = buildAutoRenameTarget(row.targetPath);
      }

      const srcResolved = resolveKbPath(this.kbRoot, row.trashPath);
      const srcStats = await fs.stat(srcResolved.absolute).catch(() => null);
      if (!srcStats || !srcStats.isDirectory()) {
        failedCount += 1;
        results.push({
          trashPath: row.trashPath,
          action,
          status: "failed",
          message: "Trash item not found."
        });
        continue;
      }

      const destinationResolved = resolveKbPath(this.kbRoot, resolvedTargetPath);
      if (isSubPath(this.trashRoot, destinationResolved.absolute)) {
        failedCount += 1;
        results.push({
          trashPath: row.trashPath,
          action,
          status: "failed",
          message: "Cannot restore into trash."
        });
        continue;
      }

      await fs.mkdir(path.dirname(destinationResolved.absolute), { recursive: true });

      const collision = await fs
        .access(destinationResolved.absolute)
        .then(() => true)
        .catch(() => false);

      if (collision) {
        failedCount += 1;
        results.push({
          trashPath: row.trashPath,
          action,
          status: "failed",
          message: "Restore collision: destination already exists."
        });
        continue;
      }

      await fs.rename(srcResolved.absolute, destinationResolved.absolute);
      await pruneEmptyParents(path.dirname(srcResolved.absolute), this.trashRoot);

      restoredCount += 1;
      const restoredPath = normalizeKbRelativePath(
        path.relative(this.kbRoot, destinationResolved.absolute)
      );
      restoredPaths.push(restoredPath);

      results.push({
        trashPath: row.trashPath,
        action,
        status: "restored",
        restoredPath
      });

      this.logger.info("Trash item restored", {
        event: "kb_restore",
        trashPath: row.trashPath,
        restoreMode: mode,
        restoredPath,
        action
      });
    }

    if (restoredCount > 0) {
      this.#markTrashCacheDirty("restore-bulk");
    }

    return {
      ok: failedCount === 0,
      mode,
      newRootPath: plan.newRootPath,
      restoredCount,
      failedCount,
      skippedCount,
      restoredPaths,
      results
    };
  }

  async restore(trashPathInput, restoreToPathInput) {
    const trashPath = normalizeKbRelativePath(trashPathInput);
    if (!trashPath || !trashPath.startsWith("_trash/")) {
      return { ok: false, message: "Invalid trash path." };
    }

    const srcResolved = resolveKbPath(this.kbRoot, trashPath);
    if (!isSubPath(this.trashRoot, srcResolved.absolute)) {
      return { ok: false, message: "Invalid trash path." };
    }

    const srcStats = await fs.stat(srcResolved.absolute).catch(() => null);
    if (!srcStats || !srcStats.isDirectory()) {
      return { ok: false, message: "Trash item not found." };
    }

    const restoreToPath = normalizeKbRelativePath(restoreToPathInput || "");
    const destinationParent = restoreToPath
      ? resolveKbPath(this.kbRoot, restoreToPath).absolute
      : this.kbRoot;

    if (isSubPath(this.trashRoot, destinationParent)) {
      return { ok: false, message: "Cannot restore into trash." };
    }

    const parentStats = await fs.stat(destinationParent).catch(() => null);
    if (!parentStats || !parentStats.isDirectory()) {
      return { ok: false, message: "Restore destination not found." };
    }

    const destination = path.join(destinationParent, path.basename(srcResolved.absolute));
    const collision = await fs
      .access(destination)
      .then(() => true)
      .catch(() => false);
    if (collision) {
      return { ok: false, message: "Restore collision: destination already exists." };
    }

    await fs.rename(srcResolved.absolute, destination);
    await pruneEmptyParents(path.dirname(srcResolved.absolute), this.trashRoot);

    const restoredPath = normalizeKbRelativePath(path.relative(this.kbRoot, destination));
    this.#markTrashCacheDirty("restore");

    this.logger.info("Trash item restored", {
      event: "kb_restore",
      trashPath,
      restoreToPath: restoreToPath || "",
      restoredPath
    });

    return { ok: true, restoredPath };
  }

  async purge(trashPathInput) {
    const trashPath = normalizeKbRelativePath(trashPathInput);
    if (!trashPath || !trashPath.startsWith("_trash/")) {
      return { ok: false, message: "Invalid trash path." };
    }

    const resolved = resolveKbPath(this.kbRoot, trashPath);
    if (!isSubPath(this.trashRoot, resolved.absolute)) {
      return { ok: false, message: "Invalid trash path." };
    }

    const exists = await fs
      .access(resolved.absolute)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return { ok: false, message: "Trash item not found." };
    }

    await fs.rm(resolved.absolute, { recursive: true, force: true });
    await pruneEmptyParents(path.dirname(resolved.absolute), this.trashRoot);
    this.#markTrashCacheDirty("purge");

    this.logger.info("Trash item purged", {
      event: "kb_purge",
      trashPath
    });

    return { ok: true };
  }

  async purgeBulk(trashPathsInput) {
    const trashPaths = normalizeTrashPathArray(trashPathsInput);
    if (!trashPaths.length) {
      return { ok: false, message: "At least one trash path is required." };
    }

    const results = [];
    let purgedCount = 0;
    let failedCount = 0;

    for (const trashPath of trashPaths) {
      const result = await this.purge(trashPath);
      if (result.ok) {
        purgedCount += 1;
        results.push({ trashPath, status: "purged" });
      } else {
        failedCount += 1;
        results.push({
          trashPath,
          status: "failed",
          message: result.message || "Unable to purge trash item."
        });
      }
    }

    return {
      ok: failedCount === 0,
      purgedCount,
      failedCount,
      results
    };
  }

  async runRetentionCleanup() {
    const now = Date.now();
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

    const entries = await fs.readdir(this.trashRoot, { withFileTypes: true }).catch(() => []);
    let purged = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const timestampMs = parseTimestamp(entry.name);
      if (!timestampMs) {
        continue;
      }

      if (now - timestampMs > retentionMs) {
        const target = path.join(this.trashRoot, entry.name);
        await fs.rm(target, { recursive: true, force: true });
        purged += 1;
      }
    }

    if (purged > 0) {
      this.#markTrashCacheDirty("retention-cleanup");
      this.logger.info("Trash retention cleanup complete", {
        event: "trash_retention_cleanup",
        purged
      });
    }

    return purged;
  }

  async #rebuildTrashTreeCacheUnlocked(startVersion = this.trashTreeVersion) {
    const children = await this.#buildDirectoryTree(this.trashRoot, "_trash");
    this.trashTreeCache = {
      label: "Trash",
      path: "_trash",
      children
    };
    this.trashTreeSerialized = null;
    this.trashTreeSerializedVersion = -1;

    const staleDuringBuild = this.trashTreeVersion !== startVersion;
    this.trashTreeCacheDirty = staleDuringBuild;

    return this.trashTreeCache;
  }

  #emptyTrashRoot() {
    return {
      label: "Trash",
      path: "_trash",
      children: []
    };
  }

  #markTrashCacheDirty(reason = "manual") {
    this.trashTreeCacheDirty = true;
    this.trashTreeVersion += 1;
    this.trashTreeSerialized = null;
    this.trashTreeSerializedVersion = -1;

    if (reason) {
      this.logger.info("Trash cache marked dirty", {
        event: "trash_cache_dirty",
        reason
      });
    }
  }

  async #buildDirectoryTree(absoluteRoot, relativeRoot) {
    const entries = await fs.readdir(absoluteRoot, { withFileTypes: true }).catch(() => []);
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const output = [];
    for (const entry of directories) {
      const absolutePath = path.join(absoluteRoot, entry.name);
      const relativePath = normalizeKbRelativePath(`${relativeRoot}/${entry.name}`);
      const children = await this.#buildDirectoryTree(absolutePath, relativePath);
      output.push({
        label: entry.name,
        path: relativePath,
        children
      });
    }

    return output;
  }
}

function normalizeRestoreMode(modeInput) {
  const mode = String(modeInput || "").trim().toLowerCase();
  return RESTORE_MODES.has(mode) ? mode : null;
}

function normalizeRestoreAction(actionInput) {
  const action = String(actionInput || "").trim().toLowerCase();
  return RESTORE_ACTIONS.has(action) ? action : null;
}

function normalizeTrashPathArray(trashPathsInput) {
  const input = Array.isArray(trashPathsInput) ? trashPathsInput : [];
  const deduped = new Set();

  input.forEach((value) => {
    const normalized = normalizeKbRelativePath(value);
    if (!normalized || !normalized.startsWith("_trash/")) {
      return;
    }
    deduped.add(normalized);
  });

  return [...deduped];
}

function normalizeRestoreEntries(entriesInput) {
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  const deduped = new Map();

  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const trashPath = normalizeKbRelativePath(entry.trashPath || "");
    if (!trashPath || !trashPath.startsWith("_trash/")) {
      return;
    }

    const action = normalizeRestoreAction(entry.action);
    deduped.set(trashPath, {
      trashPath,
      action
    });
  });

  return [...deduped.values()];
}

function parseTrashPath(trashPathInput) {
  const trashPath = normalizeKbRelativePath(trashPathInput);
  if (!trashPath || !trashPath.startsWith("_trash/")) {
    return { ok: false, message: "Invalid trash path." };
  }

  const segments = trashPath.split("/").filter(Boolean);
  if (segments.length < 3) {
    return { ok: false, message: "Invalid trash path." };
  }

  const originalPath = normalizeKbRelativePath(segments.slice(2).join("/"));
  if (!originalPath) {
    return { ok: false, message: "Invalid trash path." };
  }

  return {
    ok: true,
    trashPath,
    timestampBucket: segments[1],
    originalPath,
    itemName: path.basename(originalPath)
  };
}

function buildAutoRenameTarget(targetPathInput) {
  const targetPath = normalizeKbRelativePath(targetPathInput);
  if (!targetPath) {
    return targetPath;
  }

  const suffix = formatRestoreSuffix(new Date());
  const segments = targetPath.split("/");
  const currentName = segments.pop() || "Restored";
  const renamed = `${currentName} (restored ${suffix})`;
  return normalizeKbRelativePath([...segments, renamed].join("/"));
}

function formatRestoreSuffix(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date();
  const y = String(date.getFullYear());
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}-${hh}${mm}${ss}`;
}

function buildTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}${ms}`;
}

function parseTimestamp(value) {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(\d{3})$/.exec(value);
  if (!match) {
    return null;
  }

  const [_, y, mo, d, hh, mm, ss, ms] = match;
  const dt = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    Number(ms)
  );
  const ts = dt.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function isSubPath(root, candidate) {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

async function pruneEmptyParents(startDir, stopDir) {
  let current = path.resolve(startDir);
  const normalizedStop = path.resolve(stopDir);

  while (current.startsWith(normalizedStop) && current !== normalizedStop) {
    const entries = await fs.readdir(current).catch(() => []);
    if (entries.length > 0) {
      break;
    }
    await fs.rmdir(current).catch(() => {});
    current = path.dirname(current);
  }
}

module.exports = {
  TrashService
};
