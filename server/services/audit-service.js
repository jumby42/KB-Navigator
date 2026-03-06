const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { ensureDir, ensureFile, ensureJsonFile, writeFileAtomic } = require("../utils/fs-utils");

const DEFAULT_RETENTION_DAYS = 180;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;
const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 500;
const PRUNE_INTERVAL_FALLBACK_HOURS = 24;

const DENIED_EVENTS = new Set(["permission_denied", "lock_denied"]);
const NOISY_EVENTS = new Set([
  "kb_admin_tree_dirty",
  "kb_admin_tree_patch",
  "kb_admin_tree_patch_error",
  "kb_admin_tree_rebuild",
  "search_index_mark_dirty",
  "search_index_rebuild",
  "search_index_rebuild_fallback",
  "search_index_rebuild_failed",
  "search_index_count_fallback",
  "search_cache_clear",
  "read_cache_clear",
  "session_store_log",
  "trash_cache_dirty",
  "kb_read_error",
  "server_error"
]);

class AuditService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baseDir = config.paths.auditDirAbsolute || path.join(config.paths.dataDirAbsolute, "audit");
    this.settingsPath = path.join(this.baseDir, "settings.json");
    this.eventsPath = path.join(this.baseDir, "events.ndjson");
    this.defaultRetentionDays = normalizeRetentionDays(
      config.audit && config.audit.retentionDays,
      DEFAULT_RETENTION_DAYS
    );
    this.pruneIntervalHours = normalizePositiveInt(
      config.audit && config.audit.pruneIntervalHours,
      PRUNE_INTERVAL_FALLBACK_HOURS
    );

    this.settings = {
      version: 1,
      retentionDays: this.defaultRetentionDays
    };
    this.events = [];
    this.writeQueue = Promise.resolve();
    this.pruneTimer = null;
  }

  async initialize() {
    await ensureDir(this.baseDir);
    await ensureJsonFile(this.settingsPath, {
      version: 1,
      retentionDays: this.defaultRetentionDays
    });
    await ensureFile(this.eventsPath, "");

    await this.#loadSettings();
    await this.#loadEvents();
    await this.pruneByRetention("startup");

    const intervalMs = Math.max(1, this.pruneIntervalHours) * 60 * 60 * 1000;
    this.pruneTimer = setInterval(() => {
      void this.pruneByRetention("interval");
    }, intervalMs);
  }

  shutdown() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  getSettingsSnapshot() {
    return {
      ok: true,
      settings: {
        retentionDays: this.settings.retentionDays
      },
      runtime: this.#buildRuntime(),
      actions: this.getActionList()
    };
  }

  async updateSettings(input, actor = "system") {
    const payload = input && typeof input === "object" ? input : {};
    const nextRetentionDays = normalizeRetentionDays(payload.retentionDays, Number.NaN);
    if (!Number.isInteger(nextRetentionDays) || nextRetentionDays < MIN_RETENTION_DAYS || nextRetentionDays > MAX_RETENTION_DAYS) {
      return { ok: false, message: "retentionDays must be between 1 and 3650." };
    }

    this.settings = {
      version: 1,
      retentionDays: nextRetentionDays
    };
    await writeFileAtomic(this.settingsPath, `${JSON.stringify(this.settings, null, 2)}\n`, "utf8");
    await this.pruneByRetention("settings-update");

    await this.appendEvent({
      actor,
      role: "superadmin",
      action: "audit_settings_update",
      target: "audit.settings",
      status: "success",
      reason: `Retention set to ${nextRetentionDays} days.`
    });

    return this.getSettingsSnapshot();
  }

  async appendEvent(input) {
    const normalized = normalizeAuditEvent(input);
    if (!normalized) {
      return { ok: false, message: "Invalid audit event payload." };
    }

    await this.#withWriteLock(async () => {
      this.events.push(normalized);
      await fs.appendFile(this.eventsPath, `${JSON.stringify(normalized)}\n`, "utf8");
    });

    return { ok: true, event: normalized };
  }

  ingestLogEvent(logPayload) {
    const payload = logPayload && typeof logPayload === "object" ? logPayload : {};
    const meta = payload.meta && typeof payload.meta === "object" ? payload.meta : {};
    const eventCode = String(meta.event || "").trim();
    if (!eventCode || !isAuditableEventCode(eventCode)) {
      return;
    }

    const status = inferStatus(eventCode, payload.level);
    const reason = inferReason(payload.message, meta, status);

    const auditEvent = {
      actor: pickActor(meta),
      role: String(meta.role || "").trim(),
      action: eventCode,
      target: pickTarget(eventCode, meta),
      status,
      reason,
      ip: String(meta.ip || "").trim(),
      meta: pickCompactMeta(meta)
    };

    void this.appendEvent(auditEvent).catch(() => {});
  }

  queryEvents(queryInput) {
    const query = queryInput && typeof queryInput === "object" ? queryInput : {};
    const filters = {
      actor: String(query.actor || "").trim().toLowerCase(),
      action: String(query.action || "").trim().toLowerCase(),
      status: String(query.status || "").trim().toLowerCase(),
      from: parseTimestampFilter(query.from, false),
      to: parseTimestampFilter(query.to, true),
      q: String(query.q || "").trim().toLowerCase()
    };

    const limit = clampInt(query.limit, 1, MAX_QUERY_LIMIT, DEFAULT_QUERY_LIMIT);
    const page = clampInt(query.page, 1, 100000, 1);

    const filtered = filterEventsNewestFirst(this.events, filters);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const rows = filtered.slice(start, start + limit);

    return {
      ok: true,
      page: safePage,
      limit,
      total,
      totalPages,
      rows
    };
  }

  exportCsv(queryInput) {
    const query = queryInput && typeof queryInput === "object" ? queryInput : {};
    const filters = {
      actor: String(query.actor || "").trim().toLowerCase(),
      action: String(query.action || "").trim().toLowerCase(),
      status: String(query.status || "").trim().toLowerCase(),
      from: parseTimestampFilter(query.from, false),
      to: parseTimestampFilter(query.to, true),
      q: String(query.q || "").trim().toLowerCase()
    };

    const rows = filterEventsNewestFirst(this.events, filters);
    const header = [
      "timestamp_utc",
      "actor",
      "role",
      "action",
      "target",
      "status",
      "reason",
      "ip"
    ];

    const lines = [header.join(",")];
    rows.forEach((entry) => {
      lines.push([
        entry.timestamp,
        entry.actor,
        entry.role,
        entry.action,
        entry.target,
        entry.status,
        entry.reason,
        entry.ip
      ].map(csvEscape).join(","));
    });

    return lines.join("\n") + "\n";
  }

  getActionList() {
    const unique = new Set();
    this.events.forEach((entry) => {
      if (entry && entry.action) {
        unique.add(entry.action);
      }
    });
    return [...unique].sort((a, b) => a.localeCompare(b));
  }

  async pruneByRetention(_reason) {
    const retentionDays = normalizeRetentionDays(this.settings.retentionDays, this.defaultRetentionDays);
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    await this.#withWriteLock(async () => {
      const kept = this.events.filter((entry) => Date.parse(entry.timestamp) >= cutoff);
      if (kept.length === this.events.length) {
        return;
      }

      this.events = kept;
      const content = kept.map((entry) => JSON.stringify(entry)).join("\n");
      await writeFileAtomic(this.eventsPath, content ? `${content}\n` : "", "utf8");
    });
  }

  async #loadSettings() {
    const raw = await fs.readFile(this.settingsPath, "utf8").catch(() => "");
    if (!raw.trim()) {
      this.settings = {
        version: 1,
        retentionDays: this.defaultRetentionDays
      };
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.settings = {
        version: 1,
        retentionDays: normalizeRetentionDays(parsed && parsed.retentionDays, this.defaultRetentionDays)
      };
    } catch {
      this.settings = {
        version: 1,
        retentionDays: this.defaultRetentionDays
      };
    }
  }

  async #loadEvents() {
    const raw = await fs.readFile(this.eventsPath, "utf8").catch(() => "");
    if (!raw.trim()) {
      this.events = [];
      return;
    }

    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      try {
        const entry = normalizeAuditEvent(JSON.parse(line));
        if (entry) {
          parsed.push(entry);
        }
      } catch {
        // Skip malformed historical rows.
      }
    }

    parsed.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    this.events = parsed;
  }

  #buildRuntime() {
    const totalRows = this.events.length;
    const oldest = totalRows ? this.events[0].timestamp : "";
    const newest = totalRows ? this.events[totalRows - 1].timestamp : "";
    return {
      totalRows,
      oldestTimestamp: oldest || null,
      newestTimestamp: newest || null
    };
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

function normalizeAuditEvent(input) {
  const source = input && typeof input === "object" ? input : null;
  if (!source) {
    return null;
  }

  const action = String(source.action || "").trim();
  if (!action) {
    return null;
  }

  const timestamp = toIsoTimestamp(source.timestamp);
  const status = normalizeStatus(source.status);

  return {
    id: String(source.id || `aud-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`),
    timestamp,
    actor: String(source.actor || "system").trim() || "system",
    role: String(source.role || "").trim(),
    action,
    target: String(source.target || "").trim(),
    status,
    reason: String(source.reason || "").trim(),
    ip: String(source.ip || "").trim(),
    meta: source.meta && typeof source.meta === "object" && !Array.isArray(source.meta)
      ? source.meta
      : {}
  };
}

function normalizeStatus(statusInput) {
  const status = String(statusInput || "").trim().toLowerCase();
  if (["success", "failure", "denied", "skipped"].includes(status)) {
    return status;
  }
  return "success";
}

function toIsoTimestamp(value) {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function isAuditableEventCode(codeInput) {
  const code = String(codeInput || "").trim();
  if (!code || NOISY_EVENTS.has(code)) {
    return false;
  }

  if (code === "login_success" || code === "login_failed" || code === "logout_success") {
    return true;
  }

  if (DENIED_EVENTS.has(code)) {
    return true;
  }

  return /^(kb_|flag_|user_|password_|approval_|backup_|lock_|draft_|session_invalidate_user|ui_display_preferences_save)/.test(code);
}

function inferStatus(eventCodeInput, levelInput) {
  const eventCode = String(eventCodeInput || "").trim();
  const level = String(levelInput || "").trim().toLowerCase();

  if (DENIED_EVENTS.has(eventCode) || eventCode.endsWith("_denied")) {
    return "denied";
  }
  if (eventCode.endsWith("_skip") || eventCode.endsWith("_skipped")) {
    return "skipped";
  }
  if (eventCode.endsWith("_failed") || eventCode.endsWith("_error") || eventCode === "login_failed" || level === "error") {
    return "failure";
  }
  return "success";
}

function pickActor(meta) {
  if (!meta || typeof meta !== "object") {
    return "system";
  }

  const candidates = [meta.actor, meta.reviewer, meta.submittedBy, meta.username, meta.user];
  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "system";
}

function pickTarget(eventCodeInput, meta) {
  const eventCode = String(eventCodeInput || "").trim();
  const data = meta && typeof meta === "object" ? meta : {};

  if (data.oldPath && data.newPath) {
    return `${String(data.oldPath)} -> ${String(data.newPath)}`;
  }

  const targetFields = [
    data.path,
    data.parentPath,
    data.kbPath,
    data.archiveId,
    data.runId,
    data.file,
    data.username
  ];

  for (const candidate of targetFields) {
    const normalized = String(candidate || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  if (eventCode === "permission_denied") {
    const method = String(data.method || "").trim().toUpperCase();
    const pathValue = String(data.path || "").trim();
    return `${method} ${pathValue}`.trim();
  }

  return "";
}

function inferReason(messageInput, meta, status) {
  const message = String(messageInput || "").trim();
  const data = meta && typeof meta === "object" ? meta : {};

  if (typeof data.reason === "string" && data.reason.trim()) {
    return data.reason.trim();
  }
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (status === "denied" && Array.isArray(data.requiredRoles) && data.requiredRoles.length) {
    return `Required roles: ${data.requiredRoles.join(", ")}`;
  }
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  return message;
}

function pickCompactMeta(meta) {
  const data = meta && typeof meta === "object" ? meta : {};
  const filtered = {};
  const blockedKeys = new Set([
    "event",
    "actor",
    "reviewer",
    "submittedBy",
    "username",
    "user",
    "role",
    "path",
    "parentPath",
    "kbPath",
    "oldPath",
    "newPath",
    "archiveId",
    "runId",
    "reason",
    "error",
    "message",
    "ip"
  ]);

  Object.entries(data).forEach(([key, value]) => {
    if (blockedKeys.has(key)) {
      return;
    }

    if (["string", "number", "boolean"].includes(typeof value)) {
      filtered[key] = value;
      return;
    }

    if (Array.isArray(value)) {
      filtered[key] = value.slice(0, 10).map((entry) => String(entry));
      return;
    }

    if (value && typeof value === "object") {
      const compact = {};
      Object.entries(value).slice(0, 10).forEach(([nestedKey, nestedValue]) => {
        if (["string", "number", "boolean"].includes(typeof nestedValue)) {
          compact[nestedKey] = nestedValue;
        }
      });
      if (Object.keys(compact).length) {
        filtered[key] = compact;
      }
    }
  });

  return filtered;
}

function filterEventsNewestFirst(events, filters) {
  const fromTime = filters.from;
  const toTime = filters.to;

  const normalized = Array.isArray(events) ? events : [];
  const rows = [];

  for (let idx = normalized.length - 1; idx >= 0; idx -= 1) {
    const entry = normalized[idx];
    const ts = Date.parse(entry.timestamp);

    if (Number.isFinite(fromTime) && ts < fromTime) {
      continue;
    }
    if (Number.isFinite(toTime) && ts > toTime) {
      continue;
    }

    if (filters.status && String(entry.status || "").toLowerCase() !== filters.status) {
      continue;
    }
    if (filters.actor && !String(entry.actor || "").toLowerCase().includes(filters.actor)) {
      continue;
    }
    if (filters.action && !String(entry.action || "").toLowerCase().includes(filters.action)) {
      continue;
    }

    if (filters.q) {
      const haystack = [
        entry.actor,
        entry.action,
        entry.target,
        entry.reason,
        entry.ip,
        entry.role
      ].map((value) => String(value || "").toLowerCase()).join(" ");

      if (!haystack.includes(filters.q)) {
        continue;
      }
    }

    rows.push(entry);
  }

  return rows;
}

function parseTimestampFilter(valueInput, endOfDay) {
  const raw = String(valueInput || "").trim();
  if (!raw) {
    return Number.NaN;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const parsedDateOnly = Date.parse(raw + suffix);
    return Number.isFinite(parsedDateOnly) ? parsedDateOnly : Number.NaN;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function clampInt(valueInput, min, max, fallback) {
  const parsed = Number.parseInt(String(valueInput || ""), 10);
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

function normalizeRetentionDays(valueInput, fallback) {
  const parsed = Number.parseInt(String(valueInput || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < MIN_RETENTION_DAYS || parsed > MAX_RETENTION_DAYS) {
    return fallback;
  }
  return parsed;
}

function normalizePositiveInt(valueInput, fallback) {
  const parsed = Number.parseInt(String(valueInput || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function csvEscape(valueInput) {
  const value = String(valueInput || "");
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

module.exports = {
  AuditService
};