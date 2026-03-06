const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const { ensureDir } = require("../utils/fs-utils");

let loggerInstance = null;
const logListeners = new Set();
const logContextStorage = new AsyncLocalStorage();

async function initializeLogger(config) {
  const logsDir = config.paths.logsDirAbsolute;
  await ensureDir(logsDir);

  const transports = [
    new DailyRotateFile({
      filename: path.join(logsDir, "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: `${config.logging.retentionDays}d`,
      level: config.logging.level
    })
  ];

  if (!config.logging.fileOnly && !config.logging.consoleMinimal) {
    transports.push(new winston.transports.Console({ level: config.logging.level }));
  }

  loggerInstance = winston.createLogger({
    level: config.logging.level,
    format: winston.format.printf((info) => {
      const ts = new Date().toISOString();
      const meta = Object.entries(info)
        .filter(([key]) => !["level", "message"].includes(key))
        .map(([key, value]) => `${key}=${formatMeta(value)}`)
        .join(" ");
      return `${ts} level=${info.level} msg="${sanitizeMessage(info.message)}"${meta ? ` ${meta}` : ""}`;
    }),
    transports
  });

  wrapLoggerLevel(loggerInstance, "info");
  wrapLoggerLevel(loggerInstance, "warn");
  wrapLoggerLevel(loggerInstance, "error");

  return loggerInstance;
}

function wrapLoggerLevel(logger, level) {
  const original = typeof logger[level] === "function" ? logger[level].bind(logger) : null;
  if (!original) {
    return;
  }

  logger[level] = (...args) => {
    original(...args);
    const payload = extractLogPayload(level, args);
    payload.meta = mergeLogContext(payload.meta);
    emitLogEvent(payload);
  };
}

function extractLogPayload(level, args) {
  if (!Array.isArray(args) || !args.length) {
    return { level, message: "", meta: {} };
  }

  const first = args[0];
  const second = args.length > 1 ? args[1] : null;

  if (typeof first === "string") {
    return {
      level,
      message: first,
      meta: normalizeMeta(second)
    };
  }

  if (first instanceof Error) {
    return {
      level,
      message: first.message || "",
      meta: {
        stack: first.stack || ""
      }
    };
  }

  if (first && typeof first === "object") {
    const meta = { ...first };
    const message = typeof meta.message === "string" ? meta.message : "";
    delete meta.message;
    return {
      level,
      message,
      meta
    };
  }

  return {
    level,
    message: String(first || ""),
    meta: normalizeMeta(second)
  };
}

function normalizeMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}

function normalizeLogContext(value) {
  const source = value && typeof value === "object" ? value : {};
  const actor = String(source.actor || source.user || "").trim();
  const role = String(source.role || "").trim();
  const ip = String(source.ip || "").trim();

  return {
    actor,
    user: actor,
    role,
    ip
  };
}

function mergeLogContext(metaInput) {
  const meta = normalizeMeta(metaInput);
  const context = normalizeLogContext(logContextStorage.getStore());

  if (!context.actor && !context.role && !context.ip) {
    return meta;
  }

  if (context.actor) {
    if (!meta.actor) {
      meta.actor = context.actor;
    }
    if (!meta.user) {
      meta.user = context.actor;
    }
  }
  if (context.role && !meta.role) {
    meta.role = context.role;
  }
  if (context.ip && !meta.ip) {
    meta.ip = context.ip;
  }

  return meta;
}

function emitLogEvent(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  for (const listener of logListeners) {
    try {
      listener({
        level: payload.level || "info",
        message: String(payload.message || ""),
        meta: normalizeMeta(payload.meta)
      });
    } catch {
      // Listener failures are isolated from logging.
    }
  }
}

function registerLogListener(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

function runWithLogContext(context, fn) {
  const normalized = normalizeLogContext(context);
  return logContextStorage.run(normalized, fn);
}

function getLogger() {
  if (!loggerInstance) {
    return {
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }
  return loggerInstance;
}

function formatMeta(value) {
  if (typeof value === "string") {
    return `"${sanitizeMessage(value)}"`;
  }
  return `"${sanitizeMessage(JSON.stringify(value))}"`;
}

function sanitizeMessage(value) {
  return String(value).replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

module.exports = {
  initializeLogger,
  getLogger,
  registerLogListener,
  runWithLogContext
};
