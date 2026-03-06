const fs = require("fs/promises");
const path = require("path");
const { normalizeUsername } = require("./user-service");

const SESSION_FILE_SUFFIX = ".json";
const DESTROY_BATCH_SIZE = 24;

class SessionService {
  constructor(config, logger, sessionStore = null) {
    this.config = config;
    this.logger = logger;
    this.sessionsDir = config.paths.sessionsDirAbsolute;
    this.sessionStore = sessionStore;
    this.userToSessionIds = new Map();
    this.sessionIdToUser = new Map();
  }

  trackSession(username, sessionId) {
    const normalizedUser = normalizeUsername(username);
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedUser || !normalizedSessionId) {
      return false;
    }

    const priorUser = this.sessionIdToUser.get(normalizedSessionId);
    if (priorUser && priorUser !== normalizedUser) {
      this.#removeSessionFromUser(priorUser, normalizedSessionId);
    }

    if (!this.userToSessionIds.has(normalizedUser)) {
      this.userToSessionIds.set(normalizedUser, new Set());
    }

    this.userToSessionIds.get(normalizedUser).add(normalizedSessionId);
    this.sessionIdToUser.set(normalizedSessionId, normalizedUser);
    return true;
  }

  untrackSession(username, sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const normalizedUser = normalizeUsername(username);

    if (normalizedSessionId) {
      this.untrackSessionById(normalizedSessionId);
      return true;
    }

    if (normalizedUser) {
      this.userToSessionIds.delete(normalizedUser);
      for (const [sid, owner] of this.sessionIdToUser.entries()) {
        if (owner === normalizedUser) {
          this.sessionIdToUser.delete(sid);
        }
      }
      return true;
    }

    return false;
  }

  untrackSessionById(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }

    const owner = this.sessionIdToUser.get(normalizedSessionId);
    if (owner) {
      this.#removeSessionFromUser(owner, normalizedSessionId);
    }
    this.sessionIdToUser.delete(normalizedSessionId);
    return true;
  }

  async invalidateUserSessions(username) {
    const normalizedTarget = normalizeUsername(username);
    if (!normalizedTarget) {
      return 0;
    }

    const trackedSessionCount = this.userToSessionIds.has(normalizedTarget)
      ? this.userToSessionIds.get(normalizedTarget).size
      : 0;
    const collectedSessionIds = new Set(this.userToSessionIds.get(normalizedTarget) || []);
    const scannedSessionIds = await this.#scanSessionIdsByUser(normalizedTarget);
    for (const sid of scannedSessionIds) {
      collectedSessionIds.add(sid);
    }

    const removed = await this.#destroySessionIds(collectedSessionIds);

    this.userToSessionIds.delete(normalizedTarget);
    for (const [sid, owner] of this.sessionIdToUser.entries()) {
      if (owner === normalizedTarget) {
        this.sessionIdToUser.delete(sid);
      }
    }

    this.logger.info("User sessions invalidated", {
      event: "session_invalidate_user",
      username,
      trackedSessions: trackedSessionCount,
      scannedSessions: scannedSessionIds.size,
      removedSessions: removed
    });

    return removed;
  }

  async #scanSessionIdsByUser(normalizedTarget) {
    const files = await fs.readdir(this.sessionsDir).catch(() => []);
    const sessionIds = new Set();

    for (const file of files) {
      if (!file.endsWith(SESSION_FILE_SUFFIX)) {
        continue;
      }

      const filePath = path.join(this.sessionsDir, file);
      const raw = await fs.readFile(filePath, "utf8").catch(() => null);
      if (!raw) {
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const sessionUser = parsed && parsed.user ? parsed.user.username : "";
      if (normalizeUsername(sessionUser) !== normalizedTarget) {
        continue;
      }

      const sid = file.slice(0, -SESSION_FILE_SUFFIX.length);
      if (sid) {
        sessionIds.add(sid);
      }
    }

    return sessionIds;
  }

  async #destroySessionIds(sessionIds) {
    const ids = Array.from(sessionIds);
    if (!ids.length) {
      return 0;
    }

    let removed = 0;
    for (let index = 0; index < ids.length; index += DESTROY_BATCH_SIZE) {
      const batch = ids.slice(index, index + DESTROY_BATCH_SIZE);
      const results = await Promise.all(batch.map((sessionId) => this.#destroySessionId(sessionId)));
      for (const ok of results) {
        if (ok) {
          removed += 1;
        }
      }
    }

    return removed;
  }

  async #destroySessionId(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }

    this.untrackSessionById(normalizedSessionId);

    if (this.sessionStore && typeof this.sessionStore.destroy === "function") {
      return new Promise((resolve) => {
        this.sessionStore.destroy(normalizedSessionId, () => resolve(true));
      });
    }

    const filePath = path.join(this.sessionsDir, `${normalizedSessionId}${SESSION_FILE_SUFFIX}`);
    return fs.unlink(filePath).then(() => true).catch(() => false);
  }

  #removeSessionFromUser(normalizedUser, sessionId) {
    const sessions = this.userToSessionIds.get(normalizedUser);
    if (!sessions) {
      return;
    }

    sessions.delete(sessionId);
    if (sessions.size === 0) {
      this.userToSessionIds.delete(normalizedUser);
    }
  }
}

function normalizeSessionId(value) {
  const candidate = String(value || "").trim();
  return candidate || "";
}

module.exports = {
  SessionService
};