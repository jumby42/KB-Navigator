const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { EventEmitter } = require("node:events");
const yazl = require("yazl");
const yauzl = require("yauzl");

const { ensureDir, ensureJsonFile, nowIso, writeFileAtomic } = require("../utils/fs-utils");

const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  scope: "data+config",
  includeConfig: true,
  scheduleEnabled: false,
  schedulePreset: "daily-02:00",
  retentionMode: "count+age",
  keepLast: 14,
  maxAgeDays: 30
});

const SCHEDULE_PRESETS = new Set(["hourly", "every6hours", "daily-02:00", "weekly-sun-02:00"]);
const RETENTION_MODES = new Set(["count-only", "age-only", "count+age"]);
const ARCHIVE_ID_PATTERN = /^[A-Za-z0-9._-]+\.zip$/;
const MAX_STREAM_PROGRESS_EVENTS = 2500;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

class BackupService {
  constructor(config, logger, options = {}) {
    this.config = config;
    this.logger = logger;
    this.options = options;

    this.baseDir = config.paths.backupsDirAbsolute;
    this.archivesDir = path.join(this.baseDir, "archives");
    this.tmpDir = path.join(this.baseDir, "tmp");
    this.indexPath = path.join(this.baseDir, "index.json");
    this.settingsPath = path.join(this.baseDir, "settings.json");

    this.activeRun = null;
    this.progressEmitter = new EventEmitter();
    this.progressEmitter.setMaxListeners(200);

    this.schedulerTimer = null;
    this.schedulerActive = false;
    this.nextRunAt = "";
    this.lastRunAt = "";

    this.maintenance = {
      active: false,
      phase: "",
      runId: ""
    };

    this.restartHandler = null;
    this.settingsCache = null;
    this.settingsCacheExpiresAt = 0;
    this.indexMutationQueue = Promise.resolve();
  }

  async initialize() {
    await ensureDir(this.baseDir);
    await ensureDir(this.archivesDir);
    await ensureDir(this.tmpDir);
    await ensureJsonFile(this.indexPath, { runs: [] });
    await ensureJsonFile(this.settingsPath, { ...DEFAULT_SETTINGS });

    const settings = await this.getSettings();
    this.#syncSchedulerState(settings);
  }

  shutdown() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.schedulerActive = false;
  }

  setRestartHandler(handler) {
    this.restartHandler = typeof handler === "function" ? handler : null;
  }

  getRuntime() {
    return {
      schedulerActive: this.schedulerActive,
      nextRunAt: this.nextRunAt || "",
      lastRunAt: this.lastRunAt || "",
      runningJob: this.getActiveRun()
    };
  }

  getMaintenanceStatus() {
    return {
      active: Boolean(this.maintenance.active),
      phase: this.maintenance.phase || "",
      runId: this.maintenance.runId || ""
    };
  }

  isWriteMaintenanceActive() {
    return Boolean(this.maintenance.active);
  }

  async getSettings() {
    const now = Date.now();
    if (this.settingsCache && now < this.settingsCacheExpiresAt) {
      return { ...this.settingsCache };
    }

    const parsed = await readJson(this.settingsPath);
    const settings = normalizeSettings(parsed);
    this.settingsCache = { ...settings };
    this.settingsCacheExpiresAt = now + 1000;
    return { ...settings };
  }

  async updateSettings(input) {
    const merged = normalizeSettings({ ...(await this.getSettings()), ...(input || {}) });

    if (!SCHEDULE_PRESETS.has(merged.schedulePreset)) {
      return { ok: false, message: "Invalid schedule preset." };
    }

    if (!RETENTION_MODES.has(merged.retentionMode)) {
      return { ok: false, message: "Invalid retention mode." };
    }

    if (!Number.isInteger(merged.keepLast) || merged.keepLast < 1 || merged.keepLast > 10000) {
      return { ok: false, message: "keepLast must be between 1 and 10000." };
    }

    if (!Number.isInteger(merged.maxAgeDays) || merged.maxAgeDays < 1 || merged.maxAgeDays > 3650) {
      return { ok: false, message: "maxAgeDays must be between 1 and 3650." };
    }

    await writeFileAtomic(this.settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    this.settingsCache = { ...merged };
    this.settingsCacheExpiresAt = Date.now() + 1000;

    this.#syncSchedulerState(merged);

    this.logger.info("Backup settings updated", {
      event: "backup_settings_update",
      settings: merged
    });

    return {
      ok: true,
      settings: { ...merged },
      runtime: this.getRuntime()
    };
  }

  async listRuns(limitInput = DEFAULT_LIST_LIMIT) {
    const limit = clampInt(limitInput, 1, MAX_LIST_LIMIT, DEFAULT_LIST_LIMIT);
    const index = await this.#readIndex();
    return normalizeRunList(index.runs)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, limit);
  }

  async getRun(runIdInput) {
    const runId = normalizeRunId(runIdInput);
    if (!runId) {
      return null;
    }

    const index = await this.#readIndex();
    const runs = normalizeRunList(index.runs);
    const run = runs.find((entry) => entry.id === runId);
    return run ? structuredClone(run) : null;
  }

  getActiveRun() {
    if (!this.activeRun) {
      return null;
    }

    return {
      id: this.activeRun.id,
      type: this.activeRun.type,
      trigger: this.activeRun.trigger,
      status: this.activeRun.status,
      createdAt: this.activeRun.createdAt,
      startedAt: this.activeRun.startedAt,
      createdBy: this.activeRun.createdBy,
      label: this.activeRun.label,
      archiveId: this.activeRun.archiveId,
      progress: this.activeRun.progress,
      lastEventAt: this.activeRun.lastEventAt,
      source: this.activeRun.source || null,
      safetySnapshotRunId: this.activeRun.safetySnapshotRunId || "",
      progressEvents: Array.isArray(this.activeRun.progressEvents)
        ? this.activeRun.progressEvents.slice(-120)
        : []
    };
  }

  subscribeToRun(runIdInput, handler) {
    const runId = normalizeRunId(runIdInput);
    if (!runId || typeof handler !== "function") {
      return () => {};
    }

    const wrapped = (payload) => {
      if (!payload || payload.runId !== runId) {
        return;
      }
      handler(payload);
    };

    this.progressEmitter.on("progress", wrapped);
    return () => {
      this.progressEmitter.off("progress", wrapped);
    };
  }

  async startManualBackup(input, actor) {
    if (this.activeRun) {
      return { ok: false, message: `Another backup job is active (${this.activeRun.id}).` };
    }

    const settings = await this.getSettings();
    const run = createRunRecord({
      type: "backup",
      trigger: "manual",
      createdBy: normalizeActor(actor),
      label: normalizeLabel(input && input.label)
    });

    await this.#appendRun(run);
    this.#setActiveRun(run);

    void this.#executeBackupRun(run.id, {
      includeConfig: settings.includeConfig,
      retentionEnabled: true
    });

    return {
      ok: true,
      runId: run.id,
      status: "running"
    };
  }

  async startRestoreFromExisting(input, actor) {
    if (this.activeRun) {
      return { ok: false, message: `Another backup job is active (${this.activeRun.id}).` };
    }

    const typedConfirm = String(input && input.typedConfirm ? input.typedConfirm : "").trim().toUpperCase();
    if (typedConfirm !== "RESTORE") {
      return { ok: false, message: "Typed confirmation must be RESTORE." };
    }

    const archiveId = normalizeArchiveId(input && input.archiveId);
    if (!archiveId) {
      return { ok: false, message: "Valid archiveId is required." };
    }

    const archivePath = path.join(this.archivesDir, archiveId);
    if (!(await exists(archivePath))) {
      return { ok: false, message: "Backup archive not found." };
    }

    const run = createRunRecord({
      type: "restore",
      trigger: "manual",
      createdBy: normalizeActor(actor),
      label: normalizeLabel(input && input.label),
      source: {
        sourceType: "existing",
        archiveId
      }
    });

    await this.#appendRun(run);
    this.#setActiveRun(run);

    const settings = await this.getSettings();
    void this.#executeRestoreRun(run.id, {
      sourceType: "existing",
      archiveId,
      archivePath,
      autoRestartOnRestore: this.config.backups.autoRestartOnRestore,
      includeConfig: settings.includeConfig
    });

    return {
      ok: true,
      runId: run.id,
      status: "running",
      restartPlanned: Boolean(this.config.backups.autoRestartOnRestore)
    };
  }

  async startRestoreFromUpload(input, file, actor) {
    if (this.activeRun) {
      return { ok: false, message: `Another backup job is active (${this.activeRun.id}).` };
    }

    const typedConfirm = String(input && input.typedConfirm ? input.typedConfirm : "").trim().toUpperCase();
    if (typedConfirm !== "RESTORE") {
      return { ok: false, message: "Typed confirmation must be RESTORE." };
    }

    if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
      return { ok: false, message: "Backup archive upload is required." };
    }

    const run = createRunRecord({
      type: "restore",
      trigger: "manual",
      createdBy: normalizeActor(actor),
      label: normalizeLabel(input && input.label),
      source: {
        sourceType: "upload",
        archiveId: ""
      }
    });

    const uploadDir = path.join(this.tmpDir, run.id);
    const uploadPath = path.join(uploadDir, "upload.zip");
    await ensureDir(uploadDir);
    await fsp.writeFile(uploadPath, file.buffer);

    await this.#appendRun(run);
    this.#setActiveRun(run);

    const settings = await this.getSettings();
    void this.#executeRestoreRun(run.id, {
      sourceType: "upload",
      archiveId: "",
      archivePath: uploadPath,
      autoRestartOnRestore: this.config.backups.autoRestartOnRestore,
      includeConfig: settings.includeConfig
    });

    return {
      ok: true,
      runId: run.id,
      status: "running",
      restartPlanned: Boolean(this.config.backups.autoRestartOnRestore)
    };
  }

  async deleteRunByArchiveOrId(identifierInput) {
    const identifier = String(identifierInput || "").trim();
    if (!identifier) {
      return { ok: false, message: "Run id or archive id is required." };
    }

    const index = await this.#readIndex();
    const runs = normalizeRunList(index.runs);

    const target = runs.find((run) => run.id === identifier) || runs.find((run) => run.archiveId === identifier);
    if (!target) {
      return { ok: false, message: "Run not found." };
    }

    if (this.activeRun && this.activeRun.id === target.id) {
      return { ok: false, message: "Cannot delete active backup job." };
    }

    if (target.archiveId) {
      const archivePath = path.join(this.archivesDir, target.archiveId);
      await fsp.rm(archivePath, { force: true }).catch(() => {});
    }

    const filtered = runs.filter((run) => run.id !== target.id);
    await this.#writeIndex({ runs: filtered });
    return { ok: true, runId: target.id, archiveId: target.archiveId || "" };
  }

  async resolveArchiveForDownload(archiveIdInput) {
    const archiveId = normalizeArchiveId(archiveIdInput);
    if (!archiveId) {
      return { ok: false, message: "Invalid archive id." };
    }

    const archivePath = path.join(this.archivesDir, archiveId);
    const stat = await fsp.stat(archivePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return { ok: false, message: "Archive not found." };
    }

    return {
      ok: true,
      archiveId,
      archivePath,
      sizeBytes: stat.size
    };
  }
  async #executeBackupRun(runId, options) {
    try {
      const run = await this.#ensureRunById(runId);
      if (!run) {
        return;
      }

      const archiveId = `${run.id}.zip`;
      const archivePath = path.join(this.archivesDir, archiveId);
      const startedAt = nowIso();
      run.startedAt = startedAt;
      run.archiveId = archiveId;
      run.status = "running";
      run.progress = {
        phase: "collect",
        message: "Collecting files for backup."
      };
      await this.#upsertRun(run);
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "running",
        progress: run.progress
      });

      const collection = await this.#collectBackupFiles({ includeConfig: Boolean(options.includeConfig) });
      run.progress = {
        phase: "archive",
        message: `Creating archive (${collection.entries.length} files).`
      };
      await this.#upsertRun(run);
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "running",
        progress: run.progress,
        files: collection.entries.length
      });

      const manifest = {
        schemaVersion: 1,
        createdAt: nowIso(),
        runId: run.id,
        trigger: run.trigger,
        includeConfig: Boolean(options.includeConfig),
        source: {
          appName: this.config.app.name,
          nodeEnv: this.config.nodeEnv,
          kbRoot: normalizePathPosix(path.relative(this.config.paths.projectRoot, this.config.paths.kbRootAbsolute)),
          dataDir: normalizePathPosix(path.relative(this.config.paths.projectRoot, this.config.paths.dataDirAbsolute))
        },
        excluded: {
          volatile: ["data/sessions/**", "data/logs/**"],
          transient: ["**/.lock", "data/backups/**"]
        },
        files: collection.manifestFiles,
        totals: {
          fileCount: collection.entries.length,
          totalBytes: collection.totalBytes
        }
      };

      await createZipArchive({
        archivePath,
        entries: collection.entries,
        manifest,
        onProgress: (payload) => {
          this.#emitRunProgress(run.id, {
            eventType: "progress",
            status: "running",
            progress: {
              phase: "archive",
              message: `Archived ${payload.completed} of ${payload.total} files.`
            },
            archiveProgress: payload
          });
        }
      });

      const stat = await fsp.stat(archivePath);
      const endedAt = nowIso();
      run.status = "completed";
      run.endedAt = endedAt;
      run.durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
      run.sizeBytes = stat.size;
      run.resultSummary = {
        files: collection.entries.length,
        totalBytes: collection.totalBytes,
        manifestSchemaVersion: 1
      };
      run.errorMessage = "";
      run.progress = {
        phase: "complete",
        message: "Backup completed."
      };
      await this.#upsertRun(run);

      this.lastRunAt = endedAt;
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "completed",
        progress: run.progress
      });

      if (options && options.retentionEnabled) {
        await this.#applyRetention();
      }
    } catch (error) {
      await this.#failRun(runId, error);
    } finally {
      if (this.activeRun && this.activeRun.id === runId) {
        this.activeRun = null;
      }
      const latestSettings = await this.getSettings();
      this.#recomputeNextRun(latestSettings);
    }
  }

  async #executeRestoreRun(runId, options) {
    const tmpRoot = path.join(this.tmpDir, runId);
    const extractDir = path.join(tmpRoot, "extract");

    try {
      const run = await this.#ensureRunById(runId);
      if (!run) {
        return;
      }

      await ensureDir(tmpRoot);
      await ensureDir(extractDir);

      run.startedAt = nowIso();
      run.status = "running";
      run.progress = {
        phase: "safety-snapshot",
        message: "Creating safety snapshot before restore."
      };
      await this.#upsertRun(run);
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "running",
        progress: run.progress
      });

      const safetyRun = await this.#createSafetySnapshot(run.createdBy, run.id);
      if (!safetyRun || safetyRun.status !== "completed") {
        throw new Error("Unable to create safety snapshot before restore.");
      }
      run.safetySnapshotRunId = safetyRun.id;
      await this.#upsertRun(run);

      run.progress = {
        phase: "extract",
        message: "Extracting restore archive."
      };
      await this.#upsertRun(run);
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "running",
        progress: run.progress
      });

      const extractSummary = await extractZipSafely({
        archivePath: options.archivePath,
        destinationDir: extractDir,
        onProgress: (payload) => {
          this.#emitRunProgress(run.id, {
            eventType: "progress",
            status: "running",
            progress: {
              phase: "extract",
              message: `Extracted ${payload.completed} entries.`
            },
            extractProgress: payload
          });
        }
      });

      const manifest = await readJson(path.join(extractDir, "manifest.json"));
      if (!manifest || typeof manifest !== "object" || Number(manifest.schemaVersion) !== 1) {
        throw new Error("Restore archive manifest is missing or unsupported.");
      }

      const stagedKbRoot = path.join(extractDir, "Knowledgebase");
      const stagedDataRoot = path.join(extractDir, "data");
      if (!(await isDirectory(stagedKbRoot))) {
        throw new Error("Restore archive does not contain Knowledgebase directory.");
      }
      if (!(await isDirectory(stagedDataRoot))) {
        throw new Error("Restore archive does not contain data directory.");
      }

      run.progress = {
        phase: "apply",
        message: "Applying restore to runtime paths."
      };
      await this.#upsertRun(run);
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "running",
        progress: run.progress,
        safetySnapshotRunId: run.safetySnapshotRunId || ""
      });

      this.#setMaintenance(run.id, "apply", true);
      try {
        await this.#applyRestoreFromExtract(extractDir, run.id, options.includeConfig);
      } finally {
        this.#setMaintenance("", "", false);
      }

      if (this.options && typeof this.options.onRestoreApplied === "function") {
        await this.options.onRestoreApplied(run.id);
      }

      const endedAt = nowIso();
      run.status = "completed";
      run.endedAt = endedAt;
      run.durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(run.startedAt || endedAt));
      run.errorMessage = "";
      run.resultSummary = {
        extractedEntries: extractSummary.entries,
        extractedBytes: extractSummary.bytes,
        restartPlanned: Boolean(options.autoRestartOnRestore)
      };
      run.progress = {
        phase: "complete",
        message: "Restore completed successfully."
      };

      await this.#upsertRun(run);
      this.lastRunAt = endedAt;
      this.#emitRunProgress(run.id, {
        eventType: "status",
        status: "completed",
        progress: run.progress,
        restartPlanned: Boolean(options.autoRestartOnRestore)
      });

      if (options.autoRestartOnRestore) {
        this.#requestRestart(run.id);
      }
    } catch (error) {
      this.#setMaintenance("", "", false);
      await this.#failRun(runId, error);
    } finally {
      if (this.activeRun && this.activeRun.id === runId) {
        this.activeRun = null;
      }
      await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
      const latestSettings = await this.getSettings();
      this.#recomputeNextRun(latestSettings);
    }
  }

  async #createSafetySnapshot(actor, restoreRunId) {
    const run = createRunRecord({
      type: "backup",
      trigger: "safety-snapshot",
      createdBy: normalizeActor(actor),
      label: `safety-snapshot:${restoreRunId}`
    });
    await this.#appendRun(run);
    await this.#executeBackupRun(run.id, {
      includeConfig: true,
      retentionEnabled: true
    });

    return this.getRun(run.id);
  }

  async #applyRestoreFromExtract(extractDir, runId, includeConfig) {
    const stagedKb = path.join(extractDir, "Knowledgebase");
    const stagedData = path.join(extractDir, "data");
    const stagedConfig = path.join(extractDir, "config.json");

    const liveKb = this.config.paths.kbRootAbsolute;
    const liveData = this.config.paths.dataDirAbsolute;
    const liveConfig = path.join(this.config.paths.projectRoot, "config.json");

    const stashRoot = path.join(this.tmpDir, `stash-${runId}`);
    const stashKb = path.join(stashRoot, "kb");
    const stashData = path.join(stashRoot, "data");
    const stashConfig = path.join(stashRoot, "config");

    await ensureDir(stashRoot);

    const rollbackActions = [];

    try {
      await ensureDir(path.dirname(liveKb));
      if (await exists(liveKb)) {
        await ensureDir(path.dirname(stashKb));
        await renameWithFallback(liveKb, stashKb);
        rollbackActions.push(async () => {
          await fsp.rm(liveKb, { recursive: true, force: true }).catch(() => {});
          if (await exists(stashKb)) {
            await renameWithFallback(stashKb, liveKb);
          }
        });
      }

      await renameWithFallback(stagedKb, liveKb);

      await ensureDir(liveData);
      await ensureDir(stashData);

      const preserveNames = new Set(["sessions", "logs", "backups"]);
      const liveEntries = await fsp.readdir(liveData, { withFileTypes: true }).catch(() => []);
      const stagedEntries = await fsp.readdir(stagedData, { withFileTypes: true }).catch(() => []);

      for (const entry of liveEntries) {
        if (!entry || !entry.name || preserveNames.has(entry.name)) {
          continue;
        }

        const fromPath = path.join(liveData, entry.name);
        const toPath = path.join(stashData, entry.name);
        await renameWithFallback(fromPath, toPath);
      }

      rollbackActions.push(async () => {
        const replacedEntries = await fsp.readdir(liveData, { withFileTypes: true }).catch(() => []);
        for (const entry of replacedEntries) {
          if (!entry || !entry.name || preserveNames.has(entry.name)) {
            continue;
          }
          await fsp.rm(path.join(liveData, entry.name), { recursive: true, force: true }).catch(() => {});
        }

        const stashedEntries = await fsp.readdir(stashData, { withFileTypes: true }).catch(() => []);
        for (const entry of stashedEntries) {
          const fromPath = path.join(stashData, entry.name);
          const toPath = path.join(liveData, entry.name);
          if (await exists(fromPath)) {
            await renameWithFallback(fromPath, toPath);
          }
        }
      });

      for (const entry of stagedEntries) {
        if (!entry || !entry.name || preserveNames.has(entry.name)) {
          continue;
        }

        const fromPath = path.join(stagedData, entry.name);
        const toPath = path.join(liveData, entry.name);
        await renameWithFallback(fromPath, toPath);
      }

      if (includeConfig && (await exists(stagedConfig))) {
        if (await exists(liveConfig)) {
          await ensureDir(path.dirname(stashConfig));
          await renameWithFallback(liveConfig, stashConfig);
          rollbackActions.push(async () => {
            await fsp.rm(liveConfig, { force: true }).catch(() => {});
            if (await exists(stashConfig)) {
              await renameWithFallback(stashConfig, liveConfig);
            }
          });
        }

        await renameWithFallback(stagedConfig, liveConfig);
      }

      await fsp.rm(stashRoot, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
      for (let index = rollbackActions.length - 1; index >= 0; index -= 1) {
        await rollbackActions[index]().catch(() => {});
      }
      throw error;
    }
  }
  async #collectBackupFiles({ includeConfig }) {
    const entries = [];
    const manifestFiles = [];
    let totalBytes = 0;

    const kbEntries = await collectFiles(this.config.paths.kbRootAbsolute, {
      archivePrefix: "Knowledgebase",
      skipFile: (_absolutePath, fileName) => fileName === ".lock",
      skipDir: () => false
    });

    entries.push(...kbEntries.entries);
    manifestFiles.push(...kbEntries.manifestFiles);
    totalBytes += kbEntries.totalBytes;

    const sessionsRoot = path.resolve(this.config.paths.sessionsDirAbsolute);
    const logsRoot = path.resolve(this.config.paths.logsDirAbsolute);
    const backupsRoot = path.resolve(this.baseDir);

    const dataEntries = await collectFiles(this.config.paths.dataDirAbsolute, {
      archivePrefix: "data",
      skipFile: (absolutePath) => {
        const absolute = path.resolve(absolutePath);
        return isPathWithin(absolute, sessionsRoot)
          || isPathWithin(absolute, logsRoot)
          || isPathWithin(absolute, backupsRoot);
      },
      skipDir: (absolutePath) => {
        const absolute = path.resolve(absolutePath);
        return absolute === sessionsRoot
          || absolute === logsRoot
          || absolute === backupsRoot;
      }
    });

    entries.push(...dataEntries.entries);
    manifestFiles.push(...dataEntries.manifestFiles);
    totalBytes += dataEntries.totalBytes;

    if (includeConfig) {
      const configPath = path.join(this.config.paths.projectRoot, "config.json");
      const stat = await fsp.stat(configPath).catch(() => null);
      if (stat && stat.isFile()) {
        const checksum = await checksumFile(configPath);
        entries.push({
          absolutePath: configPath,
          archivePath: "config.json",
          sizeBytes: stat.size,
          sha256: checksum
        });
        manifestFiles.push({ path: "config.json", sizeBytes: stat.size, sha256: checksum });
        totalBytes += stat.size;
      }
    }

    return {
      entries,
      manifestFiles,
      totalBytes
    };
  }

  async #failRun(runId, error) {
    const run = await this.#ensureRunById(runId);
    if (!run) {
      return;
    }

    run.status = "failed";
    run.endedAt = nowIso();
    run.durationMs = Math.max(0, Date.parse(run.endedAt) - Date.parse(run.startedAt || run.createdAt));
    run.errorMessage = error && error.message ? error.message : "Backup job failed.";
    run.progress = {
      phase: "failed",
      message: run.errorMessage
    };

    await this.#upsertRun(run);
    this.lastRunAt = run.endedAt;

    this.#emitRunProgress(run.id, {
      eventType: "status",
      status: "failed",
      progress: run.progress,
      errorMessage: run.errorMessage
    });

    this.logger.error("Backup job failed", {
      event: "backup_run_failed",
      runId,
      error: run.errorMessage
    });
  }

  async #readIndex() {
    const parsed = await readJson(this.indexPath);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.runs)) {
      return { runs: [] };
    }
    return {
      runs: normalizeRunList(parsed.runs)
    };
  }

  async #writeIndex(payload) {
    const runs = normalizeRunList(payload && payload.runs);
    const bounded = runs
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
      .slice(-Math.max(10, Number(this.config.backups.maxRunHistory || 5000)));

    await writeFileAtomic(this.indexPath, `${JSON.stringify({ runs: bounded }, null, 2)}\n`, "utf8");
  }

  #queueIndexMutation(handler) {
    const run = this.indexMutationQueue.then(() => handler(), () => handler());
    this.indexMutationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  async #appendRun(run) {
    return this.#queueIndexMutation(async () => {
      const index = await this.#readIndex();
      index.runs.push(structuredClone(run));
      await this.#writeIndex(index);
    });
  }

  async #upsertRun(run) {
    return this.#queueIndexMutation(async () => {
      const index = await this.#readIndex();
      const runs = normalizeRunList(index.runs);
      const idx = runs.findIndex((entry) => entry.id === run.id);
      if (idx >= 0) {
        runs[idx] = structuredClone(run);
      } else {
        runs.push(structuredClone(run));
      }
      await this.#writeIndex({ runs });
    });
  }

  async #ensureRunById(runId) {
    return this.getRun(runId);
  }

  #setActiveRun(run) {
    this.activeRun = {
      id: run.id,
      type: run.type,
      trigger: run.trigger,
      status: run.status,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      createdBy: run.createdBy,
      label: run.label,
      archiveId: run.archiveId,
      source: run.source || null,
      safetySnapshotRunId: run.safetySnapshotRunId || "",
      lastEventAt: nowIso(),
      progress: {
        phase: "starting",
        message: "Job starting."
      },
      progressEvents: []
    };

    this.#emitRunProgress(run.id, {
      eventType: "status",
      status: "running",
      progress: this.activeRun.progress
    });
  }

  #emitRunProgress(runId, payload) {
    if (this.activeRun && this.activeRun.id === runId) {
      this.activeRun.lastEventAt = nowIso();
      if (payload && payload.progress) {
        this.activeRun.progress = payload.progress;
      }

      if (Array.isArray(this.activeRun.progressEvents)) {
        this.activeRun.progressEvents.push({ at: this.activeRun.lastEventAt, ...payload });
        if (this.activeRun.progressEvents.length > MAX_STREAM_PROGRESS_EVENTS) {
          this.activeRun.progressEvents.splice(0, this.activeRun.progressEvents.length - MAX_STREAM_PROGRESS_EVENTS);
        }
      }
    }

    this.progressEmitter.emit("progress", {
      runId,
      at: nowIso(),
      ...payload
    });
  }

  #setMaintenance(runId, phase, active) {
    this.maintenance.active = Boolean(active);
    this.maintenance.runId = active ? String(runId || "") : "";
    this.maintenance.phase = active ? String(phase || "") : "";
  }

  #syncSchedulerState(settings) {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (!settings.scheduleEnabled) {
      this.schedulerActive = false;
      this.nextRunAt = "";
      return;
    }

    this.schedulerActive = true;
    this.#recomputeNextRun(settings);

    const intervalMs = clampInt(this.config.backups.schedulerTickSeconds, 5, 300, 30) * 1000;
    this.schedulerTimer = setInterval(() => {
      this.#tickScheduler().catch((error) => {
        this.logger.warn("Backup scheduler tick failed", {
          event: "backup_scheduler_tick_failed",
          error: error && error.message ? error.message : String(error)
        });
      });
    }, intervalMs);
  }

  #recomputeNextRun(settings) {
    if (!settings.scheduleEnabled) {
      this.nextRunAt = "";
      return;
    }

    const next = computeNextRunDate(new Date(), settings.schedulePreset);
    this.nextRunAt = next ? next.toISOString() : "";
  }

  async #tickScheduler() {
    const settings = await this.getSettings();
    if (!settings.scheduleEnabled) {
      this.nextRunAt = "";
      return;
    }

    if (!this.nextRunAt) {
      this.#recomputeNextRun(settings);
      return;
    }

    if (this.activeRun) {
      return;
    }

    const due = Date.parse(this.nextRunAt);
    if (!Number.isFinite(due)) {
      this.#recomputeNextRun(settings);
      return;
    }

    if (Date.now() < due) {
      return;
    }

    const run = createRunRecord({
      type: "backup",
      trigger: "scheduled",
      createdBy: "system",
      label: `scheduled:${settings.schedulePreset}`
    });

    await this.#appendRun(run);
    this.#setActiveRun(run);

    void this.#executeBackupRun(run.id, {
      includeConfig: settings.includeConfig,
      retentionEnabled: true
    });

    this.#recomputeNextRun(settings);
  }

  async #applyRetention() {
    const settings = await this.getSettings();
    const mode = settings.retentionMode;

    const index = await this.#readIndex();
    const runs = normalizeRunList(index.runs)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const now = Date.now();
    const backups = runs.filter((run) => run.type === "backup" && run.status === "completed" && run.archiveId);
    const toDelete = [];

    for (let i = 0; i < backups.length; i += 1) {
      const run = backups[i];
      const ageDays = Math.floor((now - Date.parse(run.createdAt || run.startedAt || nowIso())) / (24 * 60 * 60 * 1000));
      const overCount = i >= settings.keepLast;
      const overAge = ageDays > settings.maxAgeDays;

      let shouldDelete = false;
      if (mode === "count-only") {
        shouldDelete = overCount;
      } else if (mode === "age-only") {
        shouldDelete = overAge;
      } else {
        shouldDelete = overCount || overAge;
      }

      if (shouldDelete && (!this.activeRun || this.activeRun.id !== run.id)) {
        toDelete.push(run);
      }
    }

    if (!toDelete.length) {
      return;
    }

    const deleteIds = new Set(toDelete.map((entry) => entry.id));
    for (const run of toDelete) {
      if (run.archiveId) {
        await fsp.rm(path.join(this.archivesDir, run.archiveId), { force: true }).catch(() => {});
      }
    }

    const filtered = runs.filter((run) => !deleteIds.has(run.id));
    await this.#writeIndex({ runs: filtered });
  }

  #requestRestart(runId) {
    if (!this.restartHandler) {
      this.logger.warn("Restore completed but no restart handler is configured", {
        event: "backup_restore_restart_handler_missing",
        runId
      });
      return;
    }

    setTimeout(() => {
      try {
        this.restartHandler();
      } catch (error) {
        this.logger.error("Restart handler failed", {
          event: "backup_restore_restart_handler_failed",
          runId,
          error: error && error.message ? error.message : String(error)
        });
      }
    }, 250);
  }
}
function createRunRecord({ type, trigger, createdBy, label, source = null }) {
  const runId = createRunId(type === "restore" ? "rst" : "bkp");
  const createdAt = nowIso();
  return {
    id: runId,
    type,
    trigger,
    status: "running",
    createdAt,
    startedAt: createdAt,
    endedAt: "",
    createdBy,
    label: label || "",
    archiveId: "",
    sizeBytes: 0,
    durationMs: 0,
    source: source || null,
    safetySnapshotRunId: "",
    errorMessage: "",
    resultSummary: null,
    progress: {
      phase: "starting",
      message: "Job queued."
    }
  };
}

function createRunId(prefix) {
  const stamp = new Date();
  const parts = [
    stamp.getFullYear(),
    pad2(stamp.getMonth() + 1),
    pad2(stamp.getDate()),
    "-",
    pad2(stamp.getHours()),
    pad2(stamp.getMinutes()),
    pad2(stamp.getSeconds())
  ].join("");
  const rand = crypto.randomBytes(3).toString("hex");
  return `${prefix}-${parts}-${rand}`;
}

function normalizeRunList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => normalizeRun(entry))
    .filter(Boolean);
}

function normalizeRun(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const runId = normalizeRunId(entry.id);
  if (!runId) {
    return null;
  }

  const status = ["running", "completed", "failed"].includes(entry.status) ? entry.status : "failed";
  const type = entry.type === "restore" ? "restore" : "backup";
  const trigger = ["manual", "scheduled", "safety-snapshot"].includes(entry.trigger) ? entry.trigger : "manual";

  return {
    id: runId,
    type,
    trigger,
    status,
    createdAt: String(entry.createdAt || ""),
    startedAt: String(entry.startedAt || ""),
    endedAt: String(entry.endedAt || ""),
    createdBy: normalizeActor(entry.createdBy),
    label: normalizeLabel(entry.label),
    archiveId: normalizeArchiveId(entry.archiveId) || "",
    sizeBytes: Number.isFinite(Number(entry.sizeBytes)) ? Number(entry.sizeBytes) : 0,
    durationMs: Number.isFinite(Number(entry.durationMs)) ? Number(entry.durationMs) : 0,
    source: normalizeRunSource(entry.source),
    safetySnapshotRunId: normalizeRunId(entry.safetySnapshotRunId) || "",
    errorMessage: String(entry.errorMessage || ""),
    resultSummary: entry.resultSummary && typeof entry.resultSummary === "object"
      ? structuredClone(entry.resultSummary)
      : null,
    progress: entry.progress && typeof entry.progress === "object"
      ? {
        phase: String(entry.progress.phase || ""),
        message: String(entry.progress.message || "")
      }
      : { phase: "", message: "" }
  };
}

function normalizeRunSource(source) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const sourceType = source.sourceType === "upload" ? "upload" : "existing";
  return {
    sourceType,
    archiveId: normalizeArchiveId(source.archiveId) || ""
  };
}

function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const merged = {
    ...DEFAULT_SETTINGS,
    ...source
  };

  return {
    version: 1,
    scope: "data+config",
    includeConfig: Boolean(merged.includeConfig !== false),
    scheduleEnabled: Boolean(merged.scheduleEnabled),
    schedulePreset: SCHEDULE_PRESETS.has(String(merged.schedulePreset || ""))
      ? String(merged.schedulePreset)
      : DEFAULT_SETTINGS.schedulePreset,
    retentionMode: RETENTION_MODES.has(String(merged.retentionMode || ""))
      ? String(merged.retentionMode)
      : DEFAULT_SETTINGS.retentionMode,
    keepLast: clampInt(merged.keepLast, 1, 10000, DEFAULT_SETTINGS.keepLast),
    maxAgeDays: clampInt(merged.maxAgeDays, 1, 3650, DEFAULT_SETTINGS.maxAgeDays)
  };
}

function normalizeArchiveId(input) {
  const value = String(input || "").trim();
  if (!value || !ARCHIVE_ID_PATTERN.test(value)) {
    return "";
  }
  return value;
}

function normalizeRunId(input) {
  const value = String(input || "").trim();
  if (!value || !/^[A-Za-z0-9._-]+$/.test(value)) {
    return "";
  }
  return value;
}

function normalizeActor(input) {
  const value = String(input || "").trim();
  return value || "system";
}

function normalizeLabel(input) {
  return String(input || "").trim().slice(0, 120);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
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

async function collectFiles(rootDir, options = {}) {
  const entries = [];
  const manifestFiles = [];
  let totalBytes = 0;

  await walkDirectory(rootDir, async (absolutePath, relativePathPosix, stat) => {
    const archivePath = normalizePathPosix(path.posix.join(options.archivePrefix || "", relativePathPosix));
    const checksum = await checksumFile(absolutePath);
    entries.push({
      absolutePath,
      archivePath,
      sizeBytes: stat.size,
      sha256: checksum
    });
    manifestFiles.push({
      path: archivePath,
      sizeBytes: stat.size,
      sha256: checksum
    });
    totalBytes += stat.size;
  }, {
    skipFile: options.skipFile,
    skipDir: options.skipDir
  });

  return {
    entries,
    manifestFiles,
    totalBytes
  };
}

async function walkDirectory(rootDir, onFile, options = {}) {
  const start = path.resolve(rootDir);
  if (!(await isDirectory(start))) {
    return;
  }

  async function visit(currentDir) {
    const list = await fsp.readdir(currentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of list) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (typeof options.skipDir === "function" && options.skipDir(absolutePath, entry.name)) {
          continue;
        }
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (typeof options.skipFile === "function" && options.skipFile(absolutePath, entry.name)) {
        continue;
      }

      const relativePath = normalizePathPosix(path.relative(start, absolutePath));
      const stat = await fsp.stat(absolutePath);
      await onFile(absolutePath, relativePath, stat);
    }
  }

  await visit(start);
}
async function checksumFile(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function createZipArchive({ archivePath, entries, manifest, onProgress }) {
  await ensureDir(path.dirname(archivePath));

  await new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const output = fs.createWriteStream(archivePath);

    output.on("error", reject);
    output.on("close", resolve);
    zip.outputStream.on("error", reject);

    zip.outputStream.pipe(output);

    const total = entries.length;
    let completed = 0;
    const notify = () => {
      if (typeof onProgress === "function") {
        onProgress({ completed, total });
      }
    };

    for (const entry of entries) {
      zip.addFile(entry.absolutePath, entry.archivePath);
      completed += 1;
      if (completed === total || completed % 100 === 0) {
        notify();
      }
    }

    zip.addBuffer(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"), "manifest.json");
    zip.end();
  });
}

async function extractZipSafely({ archivePath, destinationDir, onProgress }) {
  await ensureDir(destinationDir);

  const zip = await openZipFile(archivePath);
  let entries = 0;
  let bytes = 0;

  return new Promise((resolve, reject) => {
    let done = false;

    const fail = (error) => {
      if (done) {
        return;
      }
      done = true;
      zip.close();
      reject(error);
    };

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      zip.close();
      resolve({ entries, bytes });
    };

    zip.on("error", fail);
    zip.on("entry", (entry) => {
      const fileName = String(entry.fileName || "");
      const normalizedPosix = normalizeZipEntryPath(fileName);
      if (!normalizedPosix) {
        fail(new Error(`Invalid zip entry path: ${fileName}`));
        return;
      }

      const destPath = path.resolve(destinationDir, ...normalizedPosix.split("/"));
      const destinationRootWithSep = `${path.resolve(destinationDir)}${path.sep}`;
      if (destPath !== path.resolve(destinationDir) && !destPath.startsWith(destinationRootWithSep)) {
        fail(new Error(`Unsafe zip entry path: ${fileName}`));
        return;
      }

      const isDirectoryEntry = /\/$/.test(fileName);
      if (isDirectoryEntry) {
        ensureDir(destPath)
          .then(() => {
            entries += 1;
            if (typeof onProgress === "function") {
              onProgress({ completed: entries, bytes });
            }
            zip.readEntry();
          })
          .catch(fail);
        return;
      }

      ensureDir(path.dirname(destPath))
        .then(() => openZipReadStream(zip, entry))
        .then((readStream) => pipeline(readStream, fs.createWriteStream(destPath)))
        .then(() => {
          entries += 1;
          bytes += Number(entry.uncompressedSize || 0);
          if (typeof onProgress === "function") {
            onProgress({ completed: entries, bytes });
          }
          zip.readEntry();
        })
        .catch(fail);
    });

    zip.on("end", finish);
    zip.readEntry();
  });
}

function normalizeZipEntryPath(fileName) {
  const cleaned = String(fileName || "").replaceAll("\\", "/");
  if (!cleaned) {
    return "";
  }

  const normalized = path.posix.normalize(cleaned);
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || path.posix.isAbsolute(normalized)) {
    return "";
  }

  return normalized.replace(/^\/+/, "");
}

function openZipFile(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (error, zipFile) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(zipFile);
    });
  });
}

function openZipReadStream(zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stream);
    });
  });
}

function computeNextRunDate(now, preset) {
  const base = new Date(now);
  base.setMilliseconds(0);
  base.setSeconds(0);

  if (preset === "hourly") {
    base.setMinutes(0);
    base.setHours(base.getHours() + 1);
    return base;
  }

  if (preset === "every6hours") {
    base.setMinutes(0);
    const hour = base.getHours();
    const nextHour = Math.floor(hour / 6) * 6 + 6;
    if (nextHour >= 24) {
      base.setDate(base.getDate() + 1);
      base.setHours(nextHour - 24);
    } else {
      base.setHours(nextHour);
    }
    return base;
  }

  if (preset === "daily-02:00") {
    const next = new Date(base);
    next.setHours(2, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (preset === "weekly-sun-02:00") {
    const next = new Date(base);
    next.setHours(2, 0, 0, 0);
    const day = next.getDay();
    const daysUntilSunday = (7 - day) % 7;
    next.setDate(next.getDate() + daysUntilSunday);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  return null;
}

function normalizePathPosix(input) {
  return String(input || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function isPathWithin(candidate, parent) {
  const normalizedCandidate = path.resolve(candidate);
  const normalizedParent = path.resolve(parent);
  if (normalizedCandidate === normalizedParent) {
    return true;
  }
  return normalizedCandidate.startsWith(`${normalizedParent}${path.sep}`);
}

async function exists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath) {
  const stat = await fsp.stat(targetPath).catch(() => null);
  return Boolean(stat && stat.isDirectory());
}

async function renameWithFallback(fromPath, toPath) {
  await ensureDir(path.dirname(toPath));
  try {
    await fsp.rename(fromPath, toPath);
  } catch (error) {
    if (error && error.code !== "EXDEV") {
      throw error;
    }

    await copyPathRecursive(fromPath, toPath);
    await fsp.rm(fromPath, { recursive: true, force: true });
  }
}

async function copyPathRecursive(fromPath, toPath) {
  const stat = await fsp.stat(fromPath);
  if (stat.isDirectory()) {
    await ensureDir(toPath);
    const entries = await fsp.readdir(fromPath, { withFileTypes: true });
    for (const entry of entries) {
      await copyPathRecursive(path.join(fromPath, entry.name), path.join(toPath, entry.name));
    }
    return;
  }

  await ensureDir(path.dirname(toPath));
  await pipeline(fs.createReadStream(fromPath), fs.createWriteStream(toPath));
}

async function readJson(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = {
  BackupService,
  SCHEDULE_PRESETS,
  RETENTION_MODES
};



