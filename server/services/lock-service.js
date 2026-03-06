const fs = require("fs/promises");
const path = require("path");
const { normalizeKbRelativePath, resolveKbPath } = require("../utils/path-utils");
const { normalizeUsername } = require("./user-service");

class LockService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.kbRoot = config.paths.kbRootAbsolute;
    this.ttlMs = config.locks.solutionLockTtlMinutes * 60 * 1000;
  }

  async acquire(pathInput, owner) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    const ownerName = String(owner || "").trim();
    const normalizedOwner = normalizeUsername(ownerName);

    if (!normalizedPath || !normalizedOwner) {
      return { ok: false, message: "A valid solution path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (!hasSolution) {
      return { ok: false, message: "Solution path is invalid." };
    }

    const now = Date.now();
    const current = await this.#readLock(resolved.absolute);
    if (current.exists) {
      const sameOwner = normalizeUsername(current.owner) === normalizedOwner;
      if (!sameOwner && !current.expired) {
        this.logger.info("Lock denied", {
          event: "lock_denied",
          path: resolved.relative,
          owner: ownerName,
          lockOwner: current.owner,
          expiresAt: current.expiresAt
        });

        return {
          ok: false,
          locked: true,
          owner: current.owner,
          expiresAt: current.expiresAt,
          canForceUnlock: false,
          relativeTime: relativeTimeFromNow(current.expiresAt)
        };
      }

      if (!sameOwner && current.expired) {
        return {
          ok: false,
          locked: true,
          owner: current.owner,
          expiresAt: current.expiresAt,
          canForceUnlock: true,
          relativeTime: relativeTimeFromNow(current.expiresAt)
        };
      }
    }

    const next = {
      owner: ownerName,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString()
    };
    await this.#writeLock(resolved.absolute, next);

    this.logger.info("Lock acquired", {
      event: "lock_acquire",
      path: resolved.relative,
      owner: ownerName,
      expiresAt: next.expiresAt
    });

    return {
      ok: true,
      locked: false,
      owner: next.owner,
      createdAt: next.createdAt,
      expiresAt: next.expiresAt
    };
  }

  async heartbeat(pathInput, owner) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    const ownerName = String(owner || "").trim();
    const normalizedOwner = normalizeUsername(ownerName);

    if (!normalizedPath || !normalizedOwner) {
      return { ok: false, message: "A valid lock path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const current = await this.#readLock(resolved.absolute);
    if (!current.exists) {
      return { ok: false, message: "No active lock exists." };
    }

    if (normalizeUsername(current.owner) !== normalizedOwner) {
      return {
        ok: false,
        locked: true,
        owner: current.owner,
        expiresAt: current.expiresAt,
        canForceUnlock: current.expired,
        relativeTime: relativeTimeFromNow(current.expiresAt)
      };
    }

    const now = Date.now();
    const next = {
      owner: ownerName,
      createdAt: current.createdAt || new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString()
    };
    await this.#writeLock(resolved.absolute, next);

    this.logger.info("Lock heartbeat", {
      event: "lock_heartbeat",
      path: resolved.relative,
      owner: ownerName,
      expiresAt: next.expiresAt
    });

    return { ok: true, expiresAt: next.expiresAt };
  }

  async release(pathInput, owner) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    const ownerName = String(owner || "").trim();
    const normalizedOwner = normalizeUsername(ownerName);

    if (!normalizedPath || !normalizedOwner) {
      return { ok: false, message: "A valid lock path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const current = await this.#readLock(resolved.absolute);
    if (!current.exists) {
      return { ok: true, released: false };
    }

    if (normalizeUsername(current.owner) !== normalizedOwner) {
      return { ok: false, message: "Only lock owner can release this lock." };
    }

    await this.#deleteLock(resolved.absolute);
    this.logger.info("Lock released", {
      event: "lock_release",
      path: resolved.relative,
      owner: ownerName
    });

    return { ok: true, released: true };
  }

  async forceRelease(pathInput, owner) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    const ownerName = String(owner || "").trim();
    const normalizedOwner = normalizeUsername(ownerName);

    if (!normalizedPath || !normalizedOwner) {
      return { ok: false, message: "A valid lock path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const current = await this.#readLock(resolved.absolute);
    if (!current.exists) {
      return { ok: true, released: false, canForceUnlock: true };
    }

    const sameOwner = normalizeUsername(current.owner) === normalizedOwner;
    const canForceUnlock = sameOwner || current.expired;
    if (!canForceUnlock) {
      return {
        ok: false,
        released: false,
        canForceUnlock: false,
        owner: current.owner,
        expiresAt: current.expiresAt,
        relativeTime: relativeTimeFromNow(current.expiresAt)
      };
    }

    await this.#deleteLock(resolved.absolute);
    this.logger.info("Lock force released", {
      event: "lock_force_release",
      path: resolved.relative,
      owner: ownerName,
      previousOwner: current.owner,
      expired: current.expired
    });

    return { ok: true, released: true, canForceUnlock: true };
  }

  async ensureLockOwned(pathInput, owner) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    const normalizedOwner = normalizeUsername(owner);
    if (!normalizedPath || !normalizedOwner) {
      return { ok: false, message: "Lock ownership check failed." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const current = await this.#readLock(resolved.absolute);
    if (!current.exists) {
      return { ok: false, message: "No active lock exists." };
    }

    if (normalizeUsername(current.owner) !== normalizedOwner) {
      return { ok: false, message: "Solution is locked by another admin." };
    }

    if (current.expired) {
      return { ok: false, message: "Lock has expired. Re-open the solution editor." };
    }

    return { ok: true, lock: current };
  }

  async releaseLocksByOwner(username) {
    const normalizedTarget = normalizeUsername(username);
    if (!normalizedTarget) {
      return 0;
    }

    let removed = 0;
    const walk = async (absoluteDir) => {
      const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.name === "_trash" && absoluteDir === this.kbRoot) {
          continue;
        }

        const absolutePath = path.join(absoluteDir, entry.name);
        if (entry.isDirectory()) {
          const lockData = await this.#readLock(absolutePath);
          if (lockData.exists && normalizeUsername(lockData.owner) === normalizedTarget) {
            await this.#deleteLock(absolutePath);
            removed += 1;
          }
          await walk(absolutePath);
        }
      }
    };

    await walk(this.kbRoot);

    this.logger.info("Released locks for user", {
      event: "lock_release_user",
      username,
      releasedLocks: removed
    });

    return removed;
  }

  async releaseLocksByPathPrefix(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, released: 0, message: "A valid lock path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const stats = await fs.stat(resolved.absolute).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      return { ok: true, released: 0 };
    }

    let released = 0;
    const walk = async (absoluteDir) => {
      const lockData = await this.#readLock(absoluteDir);
      if (lockData.exists) {
        await this.#deleteLock(absoluteDir);
        released += 1;
      }

      const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        await walk(path.join(absoluteDir, entry.name));
      }
    };

    await walk(resolved.absolute);

    this.logger.info("Released locks for KB path", {
      event: "lock_release_path",
      path: normalizedPath,
      releasedLocks: released
    });

    return { ok: true, released };
  }

  async #readLock(solutionFolderAbsolute) {
    const lockPath = path.join(solutionFolderAbsolute, ".lock");
    const raw = await fs.readFile(lockPath, "utf8").catch(() => null);
    if (!raw) {
      return { exists: false, owner: null, createdAt: null, expiresAt: null, expired: true };
    }

    try {
      const parsed = JSON.parse(raw);
      const createdAt = toIsoOrNull(parsed.createdAt);
      const expiresAt = toIsoOrNull(parsed.expiresAt) || fallbackExpiry(createdAt, this.ttlMs);
      const owner = String(parsed.owner || "").trim();

      if (!owner || !expiresAt) {
        return {
          exists: true,
          owner: owner || "unknown",
          createdAt,
          expiresAt: expiresAt || new Date(0).toISOString(),
          expired: true
        };
      }

      return {
        exists: true,
        owner,
        createdAt,
        expiresAt,
        expired: Date.now() >= Date.parse(expiresAt)
      };
    } catch {
      return {
        exists: true,
        owner: "unknown",
        createdAt: null,
        expiresAt: new Date(0).toISOString(),
        expired: true
      };
    }
  }

  async #writeLock(solutionFolderAbsolute, lockData) {
    const lockPath = path.join(solutionFolderAbsolute, ".lock");
    await fs.writeFile(lockPath, `${JSON.stringify(lockData, null, 2)}\n`, "utf8");
  }

  async #deleteLock(solutionFolderAbsolute) {
    const lockPath = path.join(solutionFolderAbsolute, ".lock");
    await fs.unlink(lockPath).catch(() => {});
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function fallbackExpiry(createdAtIso, ttlMs) {
  const createdAtMs = createdAtIso ? Date.parse(createdAtIso) : null;
  if (!createdAtMs || Number.isNaN(createdAtMs)) {
    return null;
  }
  return new Date(createdAtMs + ttlMs).toISOString();
}

function relativeTimeFromNow(isoTime) {
  const target = Date.parse(isoTime);
  if (Number.isNaN(target)) {
    return "unknown";
  }

  const deltaMs = target - Date.now();
  const absMs = Math.abs(deltaMs);
  const minutes = Math.round(absMs / 60000);
  if (deltaMs >= 0) {
    return `in ${minutes}m`;
  }
  return `${minutes}m ago`;
}

module.exports = {
  LockService
};
