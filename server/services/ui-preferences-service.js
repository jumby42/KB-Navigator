const fs = require("fs/promises");
const { writeFileAtomic } = require("../utils/fs-utils");

const THEME_MODES = Object.freeze(["light", "dim", "dark", "black"]);
const MIN_FONT_SIZE_PX = 9;
const MAX_FONT_SIZE_PX = 20;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const DEFAULT_DISPLAY_PREFERENCES = Object.freeze({
  theme: "light",
  treeQuestionColor: "#000000",
  treeQuestionSizePx: 16,
  treeQuestionBold: true,
  treeQuestionItalic: false,
  treeQuestionUnderline: false,
  treeSolutionColor: "#000000",
  treeSolutionSizePx: 14,
  treeSolutionBold: false,
  treeSolutionItalic: false,
  treeSolutionUnderline: false,
  showQuestionTextInTree: false,
  treeQuestionTextColor: "#444444",
  treeQuestionTextSizePx: 11,
  treeQuestionTextBold: false,
  treeQuestionTextItalic: false,
  treeQuestionTextUnderline: false,
  treeHighlightColor: ""
});

const ADMIN_DISPLAY_KEYS = Object.freeze([
  "theme",
  "treeQuestionColor",
  "treeQuestionSizePx",
  "treeQuestionBold",
  "treeQuestionItalic",
  "treeQuestionUnderline",
  "treeSolutionColor",
  "treeSolutionSizePx",
  "treeSolutionBold",
  "treeSolutionItalic",
  "treeSolutionUnderline",
  "showQuestionTextInTree",
  "treeQuestionTextColor",
  "treeQuestionTextSizePx",
  "treeQuestionTextBold",
  "treeQuestionTextItalic",
  "treeQuestionTextUnderline",
  "treeHighlightColor"
]);

const USER_DISPLAY_KEYS = Object.freeze(["theme"]);

class UiPreferencesService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.filePath = config.paths.userPreferencesFileAbsolute;
    this.writeQueue = Promise.resolve();
  }

  getDefaultDisplayPreferences(roleInput) {
    const role = normalizeRole(roleInput);
    return filterDisplayByRole(DEFAULT_DISPLAY_PREFERENCES, role);
  }

  async getDisplayPreferences(usernameInput, roleInput) {
    const role = normalizeRole(roleInput);
    const username = normalizeUsername(usernameInput);
    const defaultForRole = this.getDefaultDisplayPreferences(role);

    if (!username) {
      return {
        ok: true,
        display: defaultForRole,
        canManageTree: canManageTree(role)
      };
    }

    const doc = await this.#readDocument();
    const userDoc = doc.users && typeof doc.users === "object"
      ? doc.users[username]
      : null;

    const normalized = normalizeDisplayPreferences(
      userDoc && userDoc.display && typeof userDoc.display === "object"
        ? userDoc.display
        : {}
    );

    return {
      ok: true,
      display: filterDisplayByRole(normalized, role),
      canManageTree: canManageTree(role)
    };
  }

  async saveDisplayPreferences(usernameInput, roleInput, payloadInput) {
    const role = normalizeRole(roleInput);
    const username = normalizeUsername(usernameInput);
    if (!username) {
      return { ok: false, message: "Username is required." };
    }

    const payload = payloadInput && typeof payloadInput === "object"
      ? payloadInput
      : {};
    const requestedDisplay = payload.display && typeof payload.display === "object"
      ? payload.display
      : payload;

    let nextDisplay = null;
    await this.#withWriteLock(async () => {
      const doc = await this.#readDocument();
      if (!doc.users || typeof doc.users !== "object") {
        doc.users = {};
      }

      const currentUser = doc.users[username] && typeof doc.users[username] === "object"
        ? doc.users[username]
        : {};
      const currentDisplay = normalizeDisplayPreferences(
        currentUser.display && typeof currentUser.display === "object"
          ? currentUser.display
          : {}
      );

      nextDisplay = applyDisplayPatch(currentDisplay, requestedDisplay, role);
      doc.users[username] = {
        ...currentUser,
        display: nextDisplay
      };

      await this.#writeDocument(doc);
    });

    this.logger.info("Display preferences saved", {
      event: "ui_display_preferences_save",
      username,
      role
    });

    return {
      ok: true,
      display: filterDisplayByRole(nextDisplay || DEFAULT_DISPLAY_PREFERENCES, role),
      canManageTree: canManageTree(role)
    };
  }

  async #readDocument() {
    const raw = await fs.readFile(this.filePath, "utf8").catch(() => "");
    if (!raw.trim()) {
      return { version: 1, users: {} };
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return { version: 1, users: {} };
      }
      return {
        version: 1,
        users: parsed.users && typeof parsed.users === "object" ? parsed.users : {}
      };
    } catch {
      return { version: 1, users: {} };
    }
  }

  async #writeDocument(docInput) {
    const doc = {
      version: 1,
      users: docInput && docInput.users && typeof docInput.users === "object"
        ? docInput.users
        : {}
    };
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

function normalizeUsername(usernameInput) {
  return String(usernameInput || "").trim().toLowerCase();
}

function normalizeRole(roleInput) {
  const role = String(roleInput || "user").trim().toLowerCase();
  if (["user", "admin", "superadmin"].includes(role)) {
    return role;
  }
  return "user";
}

function canManageTree(roleInput) {
  const role = normalizeRole(roleInput);
  return role === "admin" || role === "superadmin";
}

function allowedDisplayKeys(roleInput) {
  return canManageTree(roleInput) ? ADMIN_DISPLAY_KEYS : USER_DISPLAY_KEYS;
}

function normalizeTheme(themeInput, fallback = DEFAULT_DISPLAY_PREFERENCES.theme) {
  const value = String(themeInput || "").trim().toLowerCase();
  if (THEME_MODES.includes(value)) {
    return value;
  }

  const normalizedFallback = String(fallback || "").trim().toLowerCase();
  return THEME_MODES.includes(normalizedFallback)
    ? normalizedFallback
    : DEFAULT_DISPLAY_PREFERENCES.theme;
}

function normalizeHexColor(valueInput, fallback) {
  const value = String(valueInput || "").trim().toLowerCase();
  if (HEX_COLOR_PATTERN.test(value)) {
    return value;
  }

  const fallbackValue = String(fallback || "").trim().toLowerCase();
  if (HEX_COLOR_PATTERN.test(fallbackValue)) {
    return fallbackValue;
  }

  return "#000000";
}

function normalizeHighlightColor(valueInput, fallback = "") {
  const value = String(valueInput || "").trim().toLowerCase();
  if (!value) {
    return "";
  }

  if (HEX_COLOR_PATTERN.test(value)) {
    return value;
  }

  const fallbackValue = String(fallback || "").trim().toLowerCase();
  return HEX_COLOR_PATTERN.test(fallbackValue) ? fallbackValue : "";
}

function normalizeFontSize(valueInput, fallback) {
  const fallbackNumber = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : MIN_FONT_SIZE_PX;
  const parsed = Number(valueInput);
  const candidate = Number.isFinite(parsed)
    ? parsed
    : fallbackNumber;
  const clamped = Math.min(MAX_FONT_SIZE_PX, Math.max(MIN_FONT_SIZE_PX, candidate));
  return Math.round(clamped);
}

function normalizeBoolean(valueInput, fallback = false) {
  if (typeof valueInput === "boolean") {
    return valueInput;
  }
  if (valueInput === "true") {
    return true;
  }
  if (valueInput === "false") {
    return false;
  }
  return Boolean(fallback);
}

function normalizeDisplayPreferences(input) {
  const source = input && typeof input === "object" ? input : {};

  return {
    theme: normalizeTheme(source.theme, DEFAULT_DISPLAY_PREFERENCES.theme),
    treeQuestionColor: normalizeHexColor(source.treeQuestionColor, DEFAULT_DISPLAY_PREFERENCES.treeQuestionColor),
    treeQuestionSizePx: normalizeFontSize(source.treeQuestionSizePx, DEFAULT_DISPLAY_PREFERENCES.treeQuestionSizePx),
    treeQuestionBold: normalizeBoolean(source.treeQuestionBold, DEFAULT_DISPLAY_PREFERENCES.treeQuestionBold),
    treeQuestionItalic: normalizeBoolean(source.treeQuestionItalic, DEFAULT_DISPLAY_PREFERENCES.treeQuestionItalic),
    treeQuestionUnderline: normalizeBoolean(source.treeQuestionUnderline, DEFAULT_DISPLAY_PREFERENCES.treeQuestionUnderline),
    treeSolutionColor: normalizeHexColor(source.treeSolutionColor, DEFAULT_DISPLAY_PREFERENCES.treeSolutionColor),
    treeSolutionSizePx: normalizeFontSize(source.treeSolutionSizePx, DEFAULT_DISPLAY_PREFERENCES.treeSolutionSizePx),
    treeSolutionBold: normalizeBoolean(source.treeSolutionBold, DEFAULT_DISPLAY_PREFERENCES.treeSolutionBold),
    treeSolutionItalic: normalizeBoolean(source.treeSolutionItalic, DEFAULT_DISPLAY_PREFERENCES.treeSolutionItalic),
    treeSolutionUnderline: normalizeBoolean(source.treeSolutionUnderline, DEFAULT_DISPLAY_PREFERENCES.treeSolutionUnderline),
    showQuestionTextInTree: normalizeBoolean(source.showQuestionTextInTree, DEFAULT_DISPLAY_PREFERENCES.showQuestionTextInTree),
    treeQuestionTextColor: normalizeHexColor(source.treeQuestionTextColor, DEFAULT_DISPLAY_PREFERENCES.treeQuestionTextColor),
    treeQuestionTextSizePx: normalizeFontSize(source.treeQuestionTextSizePx, DEFAULT_DISPLAY_PREFERENCES.treeQuestionTextSizePx),
    treeQuestionTextBold: normalizeBoolean(source.treeQuestionTextBold, DEFAULT_DISPLAY_PREFERENCES.treeQuestionTextBold),
    treeQuestionTextItalic: normalizeBoolean(source.treeQuestionTextItalic, DEFAULT_DISPLAY_PREFERENCES.treeQuestionTextItalic),
    treeQuestionTextUnderline: normalizeBoolean(source.treeQuestionTextUnderline, DEFAULT_DISPLAY_PREFERENCES.treeQuestionTextUnderline),
    treeHighlightColor: normalizeHighlightColor(source.treeHighlightColor, DEFAULT_DISPLAY_PREFERENCES.treeHighlightColor)
  };
}

function applyDisplayPatch(currentInput, patchInput, roleInput) {
  const current = normalizeDisplayPreferences(currentInput);
  const patch = patchInput && typeof patchInput === "object" ? patchInput : {};

  const next = { ...current };
  const allowed = new Set(allowedDisplayKeys(roleInput));

  const setIfPresent = (key, normalizer) => {
    if (!allowed.has(key) || !Object.prototype.hasOwnProperty.call(patch, key)) {
      return;
    }
    next[key] = normalizer(patch[key], next[key]);
  };

  setIfPresent("theme", normalizeTheme);
  setIfPresent("treeQuestionColor", normalizeHexColor);
  setIfPresent("treeQuestionSizePx", normalizeFontSize);
  setIfPresent("treeQuestionBold", normalizeBoolean);
  setIfPresent("treeQuestionItalic", normalizeBoolean);
  setIfPresent("treeQuestionUnderline", normalizeBoolean);
  setIfPresent("treeSolutionColor", normalizeHexColor);
  setIfPresent("treeSolutionSizePx", normalizeFontSize);
  setIfPresent("treeSolutionBold", normalizeBoolean);
  setIfPresent("treeSolutionItalic", normalizeBoolean);
  setIfPresent("treeSolutionUnderline", normalizeBoolean);
  setIfPresent("showQuestionTextInTree", normalizeBoolean);
  setIfPresent("treeQuestionTextColor", normalizeHexColor);
  setIfPresent("treeQuestionTextSizePx", normalizeFontSize);
  setIfPresent("treeQuestionTextBold", normalizeBoolean);
  setIfPresent("treeQuestionTextItalic", normalizeBoolean);
  setIfPresent("treeQuestionTextUnderline", normalizeBoolean);
  setIfPresent("treeHighlightColor", normalizeHighlightColor);

  return next;
}

function filterDisplayByRole(displayInput, roleInput) {
  const normalized = normalizeDisplayPreferences(displayInput);
  const allowed = allowedDisplayKeys(roleInput);

  return allowed.reduce((acc, key) => {
    acc[key] = normalized[key];
    return acc;
  }, {});
}

module.exports = {
  UiPreferencesService,
  DEFAULT_DISPLAY_PREFERENCES,
  canManageTree
};
