const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { isPositiveInt, parseBoolean, parseInteger } = require("../utils/validators");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config.json");

const DEFAULT_CONFIG = {
  app: {
    name: "KB Navigator",
    baseUrl: "http://localhost:3000",
    trustProxy: false
  },
  paths: {
    kbRoot: "./data/Knowledgebase",
    dataDir: "./data",
    logsDir: "./data/logs",
    draftsDir: "./data/drafts",
    sessionsDir: "./data/sessions",
    backupsDir: "./data/backups",
    auditDir: "./data/audit",
    flagsFile: "./data/flags.json",
    approvalsFile: "./data/approvals.json",
    userPreferencesFile: "./data/user-preferences.json",
    versionsFile: "./data/versions.json"
  },
  auth: {
    mode: "optional",
    rememberMeDays: 7,
    loginRateLimit: {
      windowMinutes: 15,
      maxAttempts: 10
    }
  },
  rateLimit: {
    read: {
      windowSeconds: 60,
      maxRequests: 240
    },
    search: {
      windowSeconds: 60,
      maxRequests: 90
    },
    adminWrite: {
      windowSeconds: 60,
      maxRequests: 120
    }
  },
  security: {
    sessionSecret: "",
    bcryptRounds: 12
  },
  locks: {
    solutionLockTtlMinutes: 30,
    heartbeatSeconds: 120
  },
  trash: {
    retentionDays: 30
  },
  logging: {
    level: "info",
    fileOnly: true,
    consoleMinimal: true,
    format: "plain",
    rotation: "daily",
    retentionDays: 30
  },
  uploads: {
    maxImageBytes: 10485760,
    allowedImageExtensions: ["png", "jpg", "jpeg", "gif", "webp"]
  },
  passwordPolicy: {
    minLength: 8,
    requireCategories: 3,
    categories: ["lower", "upper", "number", "symbol"],
    allowedSymbols: "`~!@#$%^&*()-=_+[]\\{}|;':\",./<>?"
  },
  users: {
    allowSelfDelete: false,
    enforceCaseInsensitiveUsernames: true
  },
  sessionStore: {
    retries: 1,
    reapIntervalSeconds: 3600,
    quietLogs: true
  },
  backups: {
    uploadMaxBytes: 524288000,
    autoRestartOnRestore: true,
    schedulerTickSeconds: 30,
    maxRunHistory: 5000
  },
  audit: {
    retentionDays: 180,
    pruneIntervalHours: 24
  },
  approvals: {
    maxResolvedHistory: 2000,
    maxInlineImageBytes: 10485760,
    maxInlineTotalBytes: 52428800
  }
};

function loadConfig() {
  dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

  const fileConfig = readConfigFile(CONFIG_PATH);
  const merged = deepMerge(structuredClone(DEFAULT_CONFIG), fileConfig);
  const withEnv = applyEnvOverrides(merged);
  const finalized = normalizeAndValidate(withEnv);

  return finalized;
}

function readConfigFile(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, "utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in config.json: ${error.message}`);
  }
}

function applyEnvOverrides(config) {
  const env = process.env;

  if (env.PORT) {
    config.port = parseInteger(env.PORT, config.port || 3000);
  }

  if (env.NODE_ENV) {
    config.nodeEnv = env.NODE_ENV;
  }

  if (env.SESSION_SECRET !== undefined) {
    config.security.sessionSecret = env.SESSION_SECRET;
  }

  if (env.AUTH_MODE) {
    config.auth.mode = env.AUTH_MODE;
  }

  config.app.trustProxy = parseBoolean(env.TRUST_PROXY, config.app.trustProxy);

  if (env.KB_ROOT) {
    config.paths.kbRoot = env.KB_ROOT;
  }
  if (env.DATA_DIR) {
    config.paths.dataDir = env.DATA_DIR;
  }
  if (env.LOGS_DIR) {
    config.paths.logsDir = env.LOGS_DIR;
  }
  if (env.DRAFTS_DIR) {
    config.paths.draftsDir = env.DRAFTS_DIR;
  }
  if (env.SESSIONS_DIR) {
    config.paths.sessionsDir = env.SESSIONS_DIR;
  }
  if (env.BACKUPS_DIR) {
    config.paths.backupsDir = env.BACKUPS_DIR;
  }
  if (env.AUDIT_DIR) {
    config.paths.auditDir = env.AUDIT_DIR;
  }
  if (env.FLAGS_FILE) {
    config.paths.flagsFile = env.FLAGS_FILE;
  }
  if (env.APPROVALS_FILE) {
    config.paths.approvalsFile = env.APPROVALS_FILE;
  }
  if (env.USER_PREFERENCES_FILE) {
    config.paths.userPreferencesFile = env.USER_PREFERENCES_FILE;
  }
  if (env.VERSIONS_FILE) {
    config.paths.versionsFile = env.VERSIONS_FILE;
  }

  config.auth.rememberMeDays = parseInteger(env.REMEMBER_ME_DAYS, config.auth.rememberMeDays);
  config.auth.loginRateLimit.windowMinutes = parseInteger(
    env.LOGIN_RATE_LIMIT_WINDOW_MINUTES,
    config.auth.loginRateLimit.windowMinutes
  );
  config.auth.loginRateLimit.maxAttempts = parseInteger(
    env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    config.auth.loginRateLimit.maxAttempts
  );

  config.rateLimit.read.windowSeconds = parseInteger(
    env.READ_RATE_LIMIT_WINDOW_SECONDS,
    config.rateLimit.read.windowSeconds
  );
  config.rateLimit.read.maxRequests = parseInteger(
    env.READ_RATE_LIMIT_MAX_REQUESTS,
    config.rateLimit.read.maxRequests
  );
  config.rateLimit.search.windowSeconds = parseInteger(
    env.SEARCH_RATE_LIMIT_WINDOW_SECONDS,
    config.rateLimit.search.windowSeconds
  );
  config.rateLimit.search.maxRequests = parseInteger(
    env.SEARCH_RATE_LIMIT_MAX_REQUESTS,
    config.rateLimit.search.maxRequests
  );
  config.rateLimit.adminWrite.windowSeconds = parseInteger(
    env.ADMIN_WRITE_RATE_LIMIT_WINDOW_SECONDS,
    config.rateLimit.adminWrite.windowSeconds
  );
  config.rateLimit.adminWrite.maxRequests = parseInteger(
    env.ADMIN_WRITE_RATE_LIMIT_MAX_REQUESTS,
    config.rateLimit.adminWrite.maxRequests
  );
  config.security.bcryptRounds = parseInteger(env.BCRYPT_ROUNDS, config.security.bcryptRounds);
  config.locks.solutionLockTtlMinutes = parseInteger(
    env.LOCK_TTL_MINUTES,
    config.locks.solutionLockTtlMinutes
  );
  config.locks.heartbeatSeconds = parseInteger(
    env.LOCK_HEARTBEAT_SECONDS,
    config.locks.heartbeatSeconds
  );
  config.trash.retentionDays = parseInteger(env.TRASH_RETENTION_DAYS, config.trash.retentionDays);
  config.logging.retentionDays = parseInteger(env.LOG_RETENTION_DAYS, config.logging.retentionDays);
  config.sessionStore.retries = parseInteger(env.SESSION_STORE_RETRIES, config.sessionStore.retries);
  config.sessionStore.reapIntervalSeconds = parseInteger(
    env.SESSION_STORE_REAP_INTERVAL_SECONDS,
    config.sessionStore.reapIntervalSeconds
  );
  config.sessionStore.quietLogs = parseBoolean(env.SESSION_STORE_QUIET_LOGS, config.sessionStore.quietLogs);
  config.backups.uploadMaxBytes = parseInteger(env.BACKUP_UPLOAD_MAX_BYTES, config.backups.uploadMaxBytes);
  config.backups.autoRestartOnRestore = parseBoolean(
    env.BACKUP_AUTO_RESTART_ON_RESTORE,
    config.backups.autoRestartOnRestore
  );
  config.backups.schedulerTickSeconds = parseInteger(
    env.BACKUP_SCHEDULER_TICK_SECONDS,
    config.backups.schedulerTickSeconds
  );
  config.backups.maxRunHistory = parseInteger(env.BACKUP_MAX_RUN_HISTORY, config.backups.maxRunHistory);
  config.audit.retentionDays = parseInteger(env.AUDIT_RETENTION_DAYS, config.audit.retentionDays);
  config.audit.pruneIntervalHours = parseInteger(env.AUDIT_PRUNE_INTERVAL_HOURS, config.audit.pruneIntervalHours);
  config.approvals.maxResolvedHistory = parseInteger(
    env.APPROVALS_MAX_RESOLVED_HISTORY,
    config.approvals.maxResolvedHistory
  );
  config.approvals.maxInlineImageBytes = parseInteger(
    env.APPROVALS_MAX_INLINE_IMAGE_BYTES,
    config.approvals.maxInlineImageBytes
  );
  config.approvals.maxInlineTotalBytes = parseInteger(
    env.APPROVALS_MAX_INLINE_TOTAL_BYTES,
    config.approvals.maxInlineTotalBytes
  );

  return config;
}

function normalizeAndValidate(config) {
  config.port = parseInteger(config.port, 3000);
  config.nodeEnv = config.nodeEnv || process.env.NODE_ENV || "development";

  const errors = [];
  const requiredPaths = ["kbRoot", "dataDir"];
  for (const key of requiredPaths) {
    if (!config.paths[key]) {
      errors.push(`paths.${key} is required`);
    }
  }

  if (!["required", "optional"].includes(config.auth.mode)) {
    errors.push("auth.mode must be 'required' or 'optional'");
  }

  const intChecks = [
    ["port", config.port],
    ["auth.rememberMeDays", config.auth.rememberMeDays],
    ["auth.loginRateLimit.windowMinutes", config.auth.loginRateLimit.windowMinutes],
    ["auth.loginRateLimit.maxAttempts", config.auth.loginRateLimit.maxAttempts],
    ["security.bcryptRounds", config.security.bcryptRounds],
    ["locks.solutionLockTtlMinutes", config.locks.solutionLockTtlMinutes],
    ["locks.heartbeatSeconds", config.locks.heartbeatSeconds],
    ["trash.retentionDays", config.trash.retentionDays],
    ["logging.retentionDays", config.logging.retentionDays],
    ["uploads.maxImageBytes", config.uploads.maxImageBytes],
    ["passwordPolicy.minLength", config.passwordPolicy.minLength],
    ["rateLimit.read.windowSeconds", config.rateLimit.read.windowSeconds],
    ["rateLimit.read.maxRequests", config.rateLimit.read.maxRequests],
    ["rateLimit.search.windowSeconds", config.rateLimit.search.windowSeconds],
    ["rateLimit.search.maxRequests", config.rateLimit.search.maxRequests],
    ["rateLimit.adminWrite.windowSeconds", config.rateLimit.adminWrite.windowSeconds],
    ["rateLimit.adminWrite.maxRequests", config.rateLimit.adminWrite.maxRequests],
    ["sessionStore.retries", config.sessionStore.retries],
    ["sessionStore.reapIntervalSeconds", config.sessionStore.reapIntervalSeconds],
    ["passwordPolicy.requireCategories", config.passwordPolicy.requireCategories],
    ["backups.uploadMaxBytes", config.backups.uploadMaxBytes],
    ["backups.schedulerTickSeconds", config.backups.schedulerTickSeconds],
    ["backups.maxRunHistory", config.backups.maxRunHistory],
    ["audit.retentionDays", config.audit.retentionDays],
    ["audit.pruneIntervalHours", config.audit.pruneIntervalHours],
    ["approvals.maxResolvedHistory", config.approvals.maxResolvedHistory],
    ["approvals.maxInlineImageBytes", config.approvals.maxInlineImageBytes],
    ["approvals.maxInlineTotalBytes", config.approvals.maxInlineTotalBytes]
  ];

  for (const [label, value] of intChecks) {
    if (!isPositiveInt(value)) {
      errors.push(`${label} must be a positive integer`);
    }
  }

  if (config.nodeEnv === "production" && !config.security.sessionSecret) {
    errors.push("SESSION_SECRET must be set in production");
  }

  if (errors.length) {
    throw new Error(`Configuration validation failed:\n- ${errors.join("\n- ")}`);
  }

  if (!config.security.sessionSecret) {
    config.security.sessionSecret = crypto.randomBytes(48).toString("hex");
    config.security.generatedSessionSecret = true;
  } else {
    config.security.generatedSessionSecret = false;
  }

  config.paths.kbRootAbsolute = resolveProjectPath(config.paths.kbRoot);
  config.paths.dataDirAbsolute = resolveProjectPath(config.paths.dataDir);
  config.paths.logsDirAbsolute = resolveProjectPath(config.paths.logsDir);
  config.paths.draftsDirAbsolute = resolveProjectPath(config.paths.draftsDir);
  config.paths.sessionsDirAbsolute = resolveProjectPath(config.paths.sessionsDir);
  config.paths.backupsDirAbsolute = resolveProjectPath(config.paths.backupsDir);
  config.paths.auditDirAbsolute = resolveProjectPath(config.paths.auditDir);
  config.paths.flagsFileAbsolute = resolveProjectPath(config.paths.flagsFile);
  config.paths.approvalsFileAbsolute = resolveProjectPath(config.paths.approvalsFile);
  config.paths.userPreferencesFileAbsolute = resolveProjectPath(config.paths.userPreferencesFile);
  config.paths.versionsFileAbsolute = resolveProjectPath(config.paths.versionsFile);

  config.paths.usersFileAbsolute = path.join(config.paths.dataDirAbsolute, "users.json");
  config.paths.kbTrashRootAbsolute = path.join(config.paths.kbRootAbsolute, "_trash");
  config.paths.projectRoot = PROJECT_ROOT;

  return config;
}

function resolveProjectPath(relativeOrAbsolutePath) {
  if (!relativeOrAbsolutePath) {
    return "";
  }

  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return path.normalize(relativeOrAbsolutePath);
  }

  return path.resolve(PROJECT_ROOT, relativeOrAbsolutePath);
}

function deepMerge(target, source) {
  if (!source || typeof source !== "object") {
    return target;
  }

  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }

  return target;
}

module.exports = {
  loadConfig
};
