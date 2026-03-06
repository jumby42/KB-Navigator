const fs = require("fs/promises");
const path = require("path");
const { writeFileAtomic } = require("../utils/fs-utils");

const ROLE_VALUES = ["user", "admin", "superadmin"];
const RESTRICTION_VALUES = ["none", "roles", "users"];
const RESERVED_FLAG_NAMES = [".lock"];
const BOOTSTRAP_TEXT_COLOR_CLASSES = [
  "text-primary",
  "text-secondary",
  "text-success",
  "text-danger",
  "text-warning",
  "text-info",
  "text-light",
  "text-dark",
  "text-muted",
  "text-white"
];
const BOOTSTRAP_ICON_DEFINITIONS = require("../../public/data/bootstrap-icons.json");
const BOOTSTRAP_ICON_CLASSES = BOOTSTRAP_ICON_DEFINITIONS
  .map((entry) => entry && entry.class)
  .filter((value) => typeof value === "string" && value.trim());
const BOOTSTRAP_ICON_CLASS_SET = new Set(BOOTSTRAP_ICON_CLASSES);
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DEFAULT_FLAG_COLOR = "#6c757d";
const DEFAULT_AUTO_CONTRAST_STRICTNESS = 4.5;
const AUTO_CONTRAST_STRICTNESS_MIN = 2.5;
const AUTO_CONTRAST_STRICTNESS_MAX = 7.0;
const DEFAULT_UI_SETTINGS = Object.freeze({
  autoContrastFlagBackground: true,
  autoContrastStrictness: DEFAULT_AUTO_CONTRAST_STRICTNESS
});
class FlagService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.flagsFile = config.paths.flagsFileAbsolute;
    this.kbRoot = config.paths.kbRootAbsolute;
    this.storeCacheTtlMs = 1000;
    this.storeCacheExpiresAt = 0;
    this.storeCache = null;
    this.storeMutationQueue = Promise.resolve();
  }

  async listDefinitions() {
    const store = await this.#readStore();
    return store.flags.map((flag) => ({ ...flag }));
  }

  async getUiSettings() {
    const store = await this.#readStore();
    return { ...store.uiSettings };
  }

  async updateUiSettings(input) {
    return this.#runStoreMutation(async () => {
      const normalized = normalizeUiSettingsInput(input);
      if (!normalized.ok) {
        return normalized;
      }

      const store = await this.#readStore();
      store.uiSettings = normalizeUiSettings({ ...store.uiSettings, ...normalized.value });
      await this.#writeStore(store);

      this.logger.info("Flag UI settings updated", {
        event: "flag_ui_settings_update",
        uiSettings: { ...store.uiSettings }
      });

      return { ok: true, uiSettings: { ...store.uiSettings } };

    });
  }

  async createDefinition(input) {
    return this.#runStoreMutation(async () => {
      const store = await this.#readStore();
      const normalized = normalizeDefinitionInput(input);
      if (!normalized.ok) {
        return normalized;
      }

      const candidate = normalized.value;
      const conflict = store.flags.some((entry) => entry.name === candidate.name);
      if (conflict) {
        return { ok: false, message: "Flag already exists." };
      }

      store.flags.push(candidate);
      store.flags.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      await this.#writeStore(store);

      this.logger.info("Flag definition created", {
        event: "flag_definition_create",
        flagName: candidate.name
      });

      return { ok: true, flag: { ...candidate } };

    });
  }

  async updateDefinition(existingNameInput, input) {
    return this.#runStoreMutation(async () => {
      const existingName = normalizeFlagName(existingNameInput);
      if (!existingName) {
        return { ok: false, message: "Existing flag name is required." };
      }

      const store = await this.#readStore();
      const idx = store.flags.findIndex((entry) => entry.name === existingName);
      if (idx < 0) {
        return { ok: false, message: "Flag not found." };
      }

      const normalized = normalizeDefinitionInput(input);
      if (!normalized.ok) {
        return normalized;
      }

      const candidate = normalized.value;
      const conflict = store.flags.some((entry, entryIdx) => entryIdx !== idx && entry.name === candidate.name);
      if (conflict) {
        return { ok: false, message: "Another flag already uses that name." };
      }

      store.flags[idx] = candidate;
      store.flags.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      await this.#writeStore(store);

      let renamedAssignments = 0;
      if (existingName !== candidate.name) {
        renamedAssignments = await this.renameAssignments(existingName, candidate.name);
      }

      this.logger.info("Flag definition updated", {
        event: "flag_definition_update",
        previousName: existingName,
        flagName: candidate.name,
        renamedAssignments
      });

      return { ok: true, flag: { ...candidate }, renamedAssignments };

    });
  }

  async deleteDefinition(nameInput) {
    return this.#runStoreMutation(async () => {
      const name = normalizeFlagName(nameInput);
      if (!name) {
        return { ok: false, message: "Flag name is required." };
      }

      const store = await this.#readStore();
      const idx = store.flags.findIndex((entry) => entry.name === name);
      if (idx < 0) {
        return { ok: false, message: "Flag not found." };
      }

      const [deleted] = store.flags.splice(idx, 1);
      await this.#writeStore(store);
      const removedAssignments = await this.deleteAssignments(name);

      this.logger.info("Flag definition deleted", {
        event: "flag_definition_delete",
        flagName: deleted.name,
        removedAssignments
      });

      return { ok: true, deletedName: deleted.name, removedAssignments };

    });
  }

  async listAppliedFlags(folderAbsolute, definitionsInput) {
    const definitions = Array.isArray(definitionsInput) ? definitionsInput : await this.listDefinitions();
    if (!definitions.length) {
      return [];
    }

    const entries = await fs.readdir(folderAbsolute, { withFileTypes: true }).catch(() => []);
    const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
    return definitions.filter((definition) => files.has(definition.name)).map((definition) => ({ ...definition }));
  }

  evaluateAccess(appliedFlags, authContext) {
    const active = Array.isArray(appliedFlags) ? appliedFlags : [];
    const role = authContext && authContext.role ? String(authContext.role) : null;
    const username = authContext && authContext.user && authContext.user.username
      ? String(authContext.user.username).trim().toLowerCase()
      : "";

    for (const flag of active) {
      const mode = String(flag.restrictionType || "none");
      if (mode === "none") {
        continue;
      }

      if (mode === "roles") {
        const allowed = Array.isArray(flag.allowedRoles) ? flag.allowedRoles : [];
        if (!role || !allowed.includes(role)) {
          return { restricted: true, blockingFlag: { ...flag } };
        }
        continue;
      }

      if (mode === "users") {
        const allowedUsers = Array.isArray(flag.allowedUsers) ? flag.allowedUsers : [];
        if (!username || !allowedUsers.includes(username)) {
          return { restricted: true, blockingFlag: { ...flag } };
        }
      }
    }

    return { restricted: false, blockingFlag: null };
  }

  async normalizeSelectedFlagNames(nameList) {
    if (!Array.isArray(nameList)) {
      return { ok: false, message: "flagNames must be an array." };
    }

    const definitions = await this.listDefinitions();
    const known = new Map(definitions.map((entry) => [entry.name, entry]));
    const selected = [];

    for (const rawName of nameList) {
      const normalized = normalizeFlagName(rawName);
      if (!normalized) {
        return { ok: false, message: `Invalid flag name: ${rawName}` };
      }
      if (!known.has(normalized)) {
        return { ok: false, message: `Unknown flag: ${normalized}` };
      }
      if (!selected.includes(normalized)) {
        selected.push(normalized);
      }
    }

    return { ok: true, flagNames: selected };
  }

  async renameAssignments(oldNameInput, newNameInput) {
    const oldName = normalizeFlagName(oldNameInput);
    const newName = normalizeFlagName(newNameInput);
    if (!oldName || !newName || oldName === newName) {
      return 0;
    }

    let renamed = 0;
    await walkDirectories(this.kbRoot, async (dirPath) => {
      const oldPath = path.join(dirPath, oldName);
      const oldExists = await exists(oldPath);
      if (!oldExists) {
        return;
      }

      const newPath = path.join(dirPath, newName);
      const newExists = await exists(newPath);
      if (newExists) {
        await fs.unlink(oldPath).catch(() => {});
      } else {
        await fs.rename(oldPath, newPath).catch(async () => {
          await fs.unlink(oldPath).catch(() => {});
        });
      }
      renamed += 1;
    });
    return renamed;
  }

  async deleteAssignments(nameInput) {
    const name = normalizeFlagName(nameInput);
    if (!name) {
      return 0;
    }

    let removed = 0;
    await walkDirectories(this.kbRoot, async (dirPath) => {
      const markerPath = path.join(dirPath, name);
      if (!(await exists(markerPath))) {
        return;
      }
      await fs.unlink(markerPath).catch(() => {});
      removed += 1;
    });
    return removed;
  }

  async clearKnownAssignmentsInFolder(folderAbsolute) {
    const definitions = await this.listDefinitions();
    for (const definition of definitions) {
      const markerPath = path.join(folderAbsolute, definition.name);
      await fs.unlink(markerPath).catch(() => {});
    }
  }

  #runStoreMutation(action) {
    const run = this.storeMutationQueue.then(() => action(), () => action());
    this.storeMutationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  #ensureStoreShape(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return {
        flags: [],
        uiSettings: normalizeUiSettings(null)
      };
    }
    const flags = Array.isArray(parsed.flags) ? parsed.flags : [];
    const cleaned = [];
    for (const entry of flags) {
      const normalized = normalizeStoredDefinition(entry);
      if (normalized) {
        cleaned.push(normalized);
      }
    }
    cleaned.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    return {
      flags: cleaned,
      uiSettings: normalizeUiSettings(parsed.uiSettings)
    };
  }

  async #readStore() {
    const now = Date.now();
    if (this.storeCache && now < this.storeCacheExpiresAt) {
      return cloneStore(this.storeCache);
    }

    const raw = await fs.readFile(this.flagsFile, "utf8").catch(() => "");
    let nextStore;
    if (!raw.trim()) {
      nextStore = { flags: [], uiSettings: normalizeUiSettings(null) };
    } else {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { flags: [], uiSettings: normalizeUiSettings(null) };
      }
      nextStore = this.#ensureStoreShape(parsed);
    }

    this.storeCache = cloneStore(nextStore);
    this.storeCacheExpiresAt = now + this.storeCacheTtlMs;
    return cloneStore(nextStore);
  }
  async #writeStore(store) {
    const normalizedStore = this.#ensureStoreShape(store);
    const payload = JSON.stringify(normalizedStore, null, 2);
    await writeFileAtomic(this.flagsFile, `${payload}\n`, "utf8");
    this.storeCache = cloneStore(normalizedStore);
    this.storeCacheExpiresAt = Date.now() + this.storeCacheTtlMs;
  }
}

function cloneStore(store) {
  return structuredClone(store);
}

function normalizeStoredDefinition(entry) {
  const normalized = normalizeDefinitionInput(entry);
  return normalized.ok ? normalized.value : null;
}

function normalizeUiStrictnessValue(value, fallback = DEFAULT_UI_SETTINGS.autoContrastStrictness) {
  const fallbackNumber = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : DEFAULT_UI_SETTINGS.autoContrastStrictness;
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) ? parsed : fallbackNumber;
  const clamped = Math.min(AUTO_CONTRAST_STRICTNESS_MAX, Math.max(AUTO_CONTRAST_STRICTNESS_MIN, candidate));
  return Math.round(clamped * 10) / 10;
}

function normalizeUiSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    autoContrastFlagBackground: typeof source.autoContrastFlagBackground === "boolean"
      ? source.autoContrastFlagBackground
      : DEFAULT_UI_SETTINGS.autoContrastFlagBackground,
    autoContrastStrictness: normalizeUiStrictnessValue(
      source.autoContrastStrictness,
      DEFAULT_UI_SETTINGS.autoContrastStrictness
    )
  };
}

function normalizeUiSettingsInput(value) {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "UI settings payload is required." };
  }

  const patch = {};
  let hasChanges = false;

  if (Object.prototype.hasOwnProperty.call(value, "autoContrastFlagBackground")) {
    if (typeof value.autoContrastFlagBackground !== "boolean") {
      return { ok: false, message: "autoContrastFlagBackground must be true or false." };
    }
    patch.autoContrastFlagBackground = value.autoContrastFlagBackground;
    hasChanges = true;
  }

  if (Object.prototype.hasOwnProperty.call(value, "autoContrastStrictness")) {
    const numericStrictness = Number(value.autoContrastStrictness);
    if (!Number.isFinite(numericStrictness)) {
      return { ok: false, message: "autoContrastStrictness must be a number." };
    }

    patch.autoContrastStrictness = normalizeUiStrictnessValue(numericStrictness);
    hasChanges = true;
  }

  if (!hasChanges) {
    return { ok: false, message: "Provide at least one UI setting to update." };
  }

  return {
    ok: true,
    value: patch
  };
}

function normalizeDefinitionInput(input) {
  const name = normalizeFlagName(input && input.name);
  if (!name) {
    return { ok: false, message: "Flag name is required and must be alphanumeric with optional '-' or '_'." };
  }
  if (RESERVED_FLAG_NAMES.includes(name)) {
    return { ok: false, message: "The .lock marker is reserved and cannot be used as a custom flag." };
  }

  const message = String((input && input.message) || "").trim();
  if (!message) {
    return { ok: false, message: "Flag message is required." };
  }

  const colorClass = normalizeColorValue(input && input.colorClass);
  if (!colorClass) {
    return { ok: false, message: "Invalid flag color. Use a hex color like #6c757d or a supported bootstrap text class." };
  }

  const backgroundColor = normalizeBackgroundColorValue(input && input.backgroundColor);
  if (backgroundColor === null) {
    return { ok: false, message: "Invalid flag background color. Use a hex color like #212529." };
  }

  const iconClass = normalizeIconClass(input && input.iconClass);
  if (iconClass === null) {
    return { ok: false, message: "Invalid flag icon." };
  }

  const restrictionType = String((input && input.restrictionType) || "none").trim().toLowerCase();
  if (!RESTRICTION_VALUES.includes(restrictionType)) {
    return { ok: false, message: "Invalid restriction type." };
  }

  const allowedRoles = normalizeRoles(input && input.allowedRoles);
  const allowedUsers = normalizeUsers(input && input.allowedUsers);

  if (restrictionType === "roles" && allowedRoles.length === 0) {
    return { ok: false, message: "Choose at least one allowed role for role-based restriction." };
  }
  if (restrictionType === "users" && allowedUsers.length === 0) {
    return { ok: false, message: "Provide at least one username for user-based restriction." };
  }

  return {
    ok: true,
    value: {
      name,
      message,
      colorClass,
      backgroundColor,
      iconClass,
      restrictionType,
      allowedRoles: restrictionType === "roles" ? allowedRoles : [],
      allowedUsers: restrictionType === "users" ? allowedUsers : []
    }
  };
}

function normalizeFlagName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  const withoutDot = raw.startsWith(".") ? raw.slice(1) : raw;
  if (!withoutDot || !/^[a-z0-9][a-z0-9_-]*$/.test(withoutDot)) {
    return "";
  }

  return `.${withoutDot}`;
}

function normalizeColorValue(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return DEFAULT_FLAG_COLOR;
  }
  if (HEX_COLOR_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }
  if (BOOTSTRAP_TEXT_COLOR_CLASSES.includes(candidate)) {
    return candidate;
  }
  return "";
}

function normalizeBackgroundColorValue(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }
  if (!HEX_COLOR_PATTERN.test(candidate)) {
    return null;
  }
  return candidate.toLowerCase();
}

function normalizeIconClass(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }
  if (!BOOTSTRAP_ICON_CLASS_SET.has(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeRoles(value) {
  const list = Array.isArray(value) ? value : [];
  const normalized = [];
  for (const role of list) {
    const candidate = String(role || "").trim().toLowerCase();
    if (!ROLE_VALUES.includes(candidate)) {
      continue;
    }
    if (!normalized.includes(candidate)) {
      normalized.push(candidate);
    }
  }
  return normalized;
}

function normalizeUsers(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const normalized = [];
  for (const entry of rawValues) {
    const candidate = String(entry || "").trim().toLowerCase();
    if (!candidate) {
      continue;
    }
    if (!/^[a-z0-9._-]+$/.test(candidate)) {
      continue;
    }
    if (!normalized.includes(candidate)) {
      normalized.push(candidate);
    }
  }
  return normalized;
}

async function walkDirectories(rootAbsolute, onDirectory) {
  const visit = async (dirAbsolute) => {
    await onDirectory(dirAbsolute);
    const entries = await fs.readdir(dirAbsolute, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }
      await visit(path.join(dirAbsolute, entry.name));
    }
  };

  await visit(rootAbsolute);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  FlagService,
  ROLE_VALUES,
  RESTRICTION_VALUES,
  RESERVED_FLAG_NAMES,
  BOOTSTRAP_TEXT_COLOR_CLASSES,
  BOOTSTRAP_ICON_CLASSES
};
