const path = require("path");

const FOLDER_NAME_PATTERN = /^[A-Za-z0-9 -]+$/;

function normalizeKbRelativePath(inputPath = "") {
  const normalized = String(inputPath).replaceAll("\\", "/").trim();
  const cleaned = normalized.replace(/^\/+|\/+$/g, "");
  return cleaned;
}

function resolveKbPath(kbRootAbsolute, kbRelativePath = "") {
  const relative = normalizeKbRelativePath(kbRelativePath);
  const candidate = path.resolve(kbRootAbsolute, relative);

  const kbRootWithSep = `${path.resolve(kbRootAbsolute)}${path.sep}`;
  if (candidate !== path.resolve(kbRootAbsolute) && !candidate.startsWith(kbRootWithSep)) {
    throw new Error("Invalid path");
  }

  return { absolute: candidate, relative };
}

function validateFolderName(name) {
  if (!name || typeof name !== "string") {
    return { ok: false, message: "Folder name is required." };
  }

  if (!FOLDER_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      message: "Invalid folder name. Use letters, numbers, spaces, and dashes only."
    };
  }

  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return { ok: false, message: "Invalid folder name." };
  }

  return { ok: true };
}

function splitRelativeSegments(kbRelativePath = "") {
  const normalized = normalizeKbRelativePath(kbRelativePath);
  if (!normalized) {
    return [];
  }

  return normalized.split("/");
}

function joinRelativeSegments(segments) {
  return segments.filter(Boolean).join("/");
}

module.exports = {
  normalizeKbRelativePath,
  resolveKbPath,
  validateFolderName,
  splitRelativeSegments,
  joinRelativeSegments
};
