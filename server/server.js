const path = require("path");
const express = require("express");
const session = require("express-session");
const FileStoreFactory = require("session-file-store");

const { loadConfig } = require("./services/config-service");
const { initializeLogger, registerLogListener, runWithLogContext } = require("./services/log-service");
const { sanitizeSolutionHtml } = require("./services/sanitize-service");
const { UserService } = require("./services/user-service");
const { AuthService } = require("./services/auth-service");
const { KBService } = require("./services/kb-service");
const { LockService } = require("./services/lock-service");
const { FlagService } = require("./services/flag-service");
const { DraftService } = require("./services/draft-service");
const { TrashService } = require("./services/trash-service");
const { VersionService } = require("./services/version-service");
const { ApprovalService } = require("./services/approval-service");
const { KBAdminService } = require("./services/kb-admin-service");
const { SessionService } = require("./services/session-service");
const { BackupService } = require("./services/backup-service");
const { AuditService } = require("./services/audit-service");
const { UiPreferencesService } = require("./services/ui-preferences-service");
const { ensureDir, ensureJsonFile, assertReadWrite } = require("./utils/fs-utils");
const { attachAuthContext } = require("./middleware/require-auth");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler");
const { createWriteMaintenanceGuard } = require("./middleware/maintenance-guard");
const { createSetupRouter } = require("./routes/setup");
const { createAuthRouter } = require("./routes/auth");
const { createReadRouter } = require("./routes/read");
const { createAdminRouter } = require("./routes/admin");
const { createReviewsRouter } = require("./routes/reviews");
const { createUsersRouter } = require("./routes/users");
const { createUserSelfRouter } = require("./routes/user-self");
const { createFlagsRouter } = require("./routes/flags");
const { createBackupsRouter } = require("./routes/backups");
const { createApprovalsRouter } = require("./routes/approvals");
const { createAuditRouter, createSuperadminAuditRouter } = require("./routes/audit");
const { createUiPreferencesRouter } = require("./routes/ui-preferences");
const { createAdminWriteRateLimiter } = require("./middleware/rate-limit");

async function createApp() {
  const config = loadConfig();

  if (config.security.generatedSessionSecret) {
    console.warn("Warning: SESSION_SECRET not set. Generated temporary dev secret for this process.");
  }

  await initializeRuntimePaths(config);
  const logger = await initializeLogger(config);

  const app = express();
  app.locals.logger = logger;
  app.set("trust proxy", config.app.trustProxy);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ extended: true }));

  const FileStore = FileStoreFactory(session);
  const sessionStore = new FileStore({
    path: config.paths.sessionsDirAbsolute,
    ttl: config.auth.rememberMeDays * 24 * 60 * 60,
    retries: config.sessionStore.retries,
    reapInterval: config.sessionStore.reapIntervalSeconds,
    logFn: createSessionStoreLogFn(logger, config)
  });
  const sessionService = new SessionService(config, logger, sessionStore);

  app.use(
    session({
      name: "kbn.sid",
      secret: config.security.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: config.nodeEnv === "production" ? "auto" : false,
        sameSite: "lax"
      }
    })
  );

  app.use(attachAuthContext(config));
  app.use((req, _res, next) => {
    const authUser = req.auth && req.auth.user ? req.auth.user : null;
    const sessionUser = req.session && req.session.user ? req.session.user : null;
    const principal = authUser || sessionUser;
    const username = principal && principal.username ? String(principal.username).trim() : "";
    const role = req.auth && req.auth.role
      ? String(req.auth.role || "").trim()
      : (principal && principal.role ? String(principal.role || "").trim() : "");
    const ip = String(req.ip || "").trim();

    return runWithLogContext(
      {
        actor: username,
        user: username,
        role,
        ip
      },
      () => {
        if (sessionService && typeof sessionService.trackSession === "function") {
          sessionService.trackSession(username, req.sessionID);
        }
        next();
      }
    );
  });

  const userService = new UserService(config, logger);
  const authService = new AuthService(config, logger, userService);
  const flagService = new FlagService(config, logger);
  const kbService = new KBService(config, logger, { sanitizeSolutionHtml }, flagService);
  await kbService.initializeSearchIndex();
  const lockService = new LockService(config, logger);
  const draftService = new DraftService(config, logger);
  const trashService = new TrashService(config, logger);
  const versionService = new VersionService(config, logger);
  const kbAdminService = new KBAdminService(config, logger, { sanitizeSolutionHtml }, draftService, flagService, versionService);
  const approvalService = new ApprovalService(config, logger);
  const backupService = new BackupService(config, logger, {
    onRestoreApplied: async (runId) => {
      if (kbAdminService && typeof kbAdminService.markTreeCacheDirty === "function") {
        kbAdminService.markTreeCacheDirty(`backup-restore:${runId}`);
      }
      if (kbService && typeof kbService.markReadCacheDirty === "function") {
        kbService.markReadCacheDirty(`backup-restore:${runId}`);
      }
      if (kbService && typeof kbService.rebuildSearchIndex === "function") {
        await kbService.rebuildSearchIndex(`backup-restore:${runId}`);
      }
    }
  });
  await backupService.initialize();

  const auditService = new AuditService(config, logger);
  await auditService.initialize();
  const stopAuditLogCapture = registerLogListener((payload) => {
    if (auditService && typeof auditService.ingestLogEvent === "function") {
      auditService.ingestLogEvent(payload);
    }
  });

  const uiPreferencesService = new UiPreferencesService(config, logger);

  const superadminWriteRateLimiter = createAdminWriteRateLimiter(config);
  const writeMaintenanceGuard = createWriteMaintenanceGuard(backupService);

  await trashService.runRetentionCleanup();

  app.use("/api/setup", createSetupRouter({ userService }));
  app.use("/api/ui/preferences", createUiPreferencesRouter({ uiPreferencesService }));
  app.use("/api/auth", createAuthRouter({ config, authService, userService, logger, sessionService }));
  app.use("/api/user", createUserSelfRouter({ userService }));
  app.use(
    "/api/superadmin/flags",
    superadminWriteRateLimiter,
    writeMaintenanceGuard,
    createFlagsRouter({ flagService, kbService })
  );
  app.use("/api", createReadRouter({ kbService, config, flagService }));
  app.use(
    "/api/admin/reviews",
    writeMaintenanceGuard,
    createReviewsRouter({
      config,
      approvalService,
      lockService,
      kbAdminService,
      kbService
    })
  );
  app.use(
    "/api/admin",
    writeMaintenanceGuard,
    createAdminRouter({
      config,
      kbAdminService,
      trashService,
      lockService,
      draftService,
      versionService,
      kbService,
      approvalService
    })
  );
  app.use("/api/admin/audit", createAuditRouter({ auditService }));
  app.use(
    "/api/superadmin/users",
    superadminWriteRateLimiter,
    writeMaintenanceGuard,
    createUsersRouter({ userService, sessionService, draftService, lockService, approvalService })
  );
  app.use(
    "/api/superadmin/approvals",
    superadminWriteRateLimiter,
    writeMaintenanceGuard,
    createApprovalsRouter({ approvalService })
  );
  app.use(
    "/api/superadmin/backups",
    superadminWriteRateLimiter,
    writeMaintenanceGuard,
    createBackupsRouter({ config, backupService })
  );
  app.use(
    "/api/superadmin/audit",
    superadminWriteRateLimiter,
    writeMaintenanceGuard,
    createSuperadminAuditRouter({ auditService })
  );

  app.use("/public", express.static(path.join(config.paths.projectRoot, "public")));
  app.get("/app.js", (_req, res) => {
    res.sendFile(path.join(config.paths.projectRoot, "app.js"));
  });
  app.get("/", (_req, res) => {
    res.sendFile(path.join(config.paths.projectRoot, "index.html"));
  });

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  const shutdown = async () => {
    shutdownSessionStoreReaper(sessionStore);
    if (backupService && typeof backupService.shutdown === "function") {
      backupService.shutdown();
    }
    if (auditService && typeof auditService.shutdown === "function") {
      auditService.shutdown();
    }
    if (typeof stopAuditLogCapture === "function") {
      stopAuditLogCapture();
    }
  };

  return { app, config, shutdown, backupService, auditService };
}

async function initializeRuntimePaths(config) {
  await ensureDir(config.paths.dataDirAbsolute);
  await ensureDir(config.paths.kbRootAbsolute);
  await ensureDir(config.paths.kbTrashRootAbsolute);
  await ensureDir(config.paths.draftsDirAbsolute);
  await ensureDir(config.paths.sessionsDirAbsolute);
  await ensureDir(config.paths.logsDirAbsolute);
  await ensureDir(config.paths.backupsDirAbsolute);
  await ensureDir(config.paths.auditDirAbsolute);
  await ensureJsonFile(config.paths.usersFileAbsolute, []);
  await ensureJsonFile(config.paths.flagsFileAbsolute, {
    flags: [],
    uiSettings: {
      autoContrastFlagBackground: true,
      autoContrastStrictness: 4.5
    }
  });
  await ensureJsonFile(config.paths.versionsFileAbsolute, { paths: {} });
  await ensureJsonFile(config.paths.approvalsFileAbsolute, {
    version: 1,
    settings: {
      flagEditsRequireApproval: false
    },
    submissions: []
  });
  await ensureJsonFile(config.paths.userPreferencesFileAbsolute, { version: 1, users: {} });

  await assertReadWrite(config.paths.kbRootAbsolute);
  await assertReadWrite(config.paths.dataDirAbsolute);
}

async function start() {
  try {
    const { app, config, shutdown, backupService } = await createApp();
    const server = app.listen(config.port, () => {
      console.log(`KB Navigator running on port ${config.port}`);
    });

    let stopping = false;
    const gracefulExit = () => {
      if (stopping) {
        return;
      }
      stopping = true;
      server.close(async () => {
        await shutdown();
        process.exit(0);
      });
    };

    if (backupService && typeof backupService.setRestartHandler === "function") {
      backupService.setRestartHandler(() => {
        console.log("Backup restore requested process restart.");
        gracefulExit();
      });
    }

    process.on("SIGINT", gracefulExit);
    process.on("SIGTERM", gracefulExit);
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

function createSessionStoreLogFn(logger, config) {
  if (config && config.sessionStore && config.sessionStore.quietLogs) {
    return () => {};
  }

  return (message) => {
    if (logger && typeof logger.warn === "function") {
      logger.warn(String(message || "session store warning"), {
        event: "session_store_log"
      });
    }
  };
}

function shutdownSessionStoreReaper(sessionStore) {
  if (!sessionStore || !sessionStore.options || !sessionStore.options.reapIntervalObject) {
    return;
  }

  clearInterval(sessionStore.options.reapIntervalObject);
  sessionStore.options.reapIntervalObject = null;
}

if (require.main === module) {
  start();
}

module.exports = {
  createApp,
  start
};