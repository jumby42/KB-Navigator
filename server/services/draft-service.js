const fs = require("fs/promises");
const path = require("path");
const { normalizeKbRelativePath } = require("../utils/path-utils");
const { normalizeUsername } = require("./user-service");

class DraftService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.draftsDir = config.paths.draftsDirAbsolute;
  }

  async getDraft(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return null;
    }

    const draftFile = this.#draftFilePath(normalizedPath);
    const record = await readDraftRecord(draftFile, normalizedPath);
    if (!record) {
      return null;
    }

    return {
      path: record.path,
      owner: record.owner,
      content: record.content,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async saveDraft({ pathInput, owner, content }) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    const ownerName = String(owner || "").trim();
    if (!normalizedPath || !ownerName) {
      return { ok: false, message: "Draft path and owner are required." };
    }

    const existing = await this.getDraft(normalizedPath);
    const now = new Date().toISOString();
    const record = {
      path: normalizedPath,
      owner: ownerName,
      content: String(content || ""),
      createdAt: existing && existing.createdAt ? existing.createdAt : now,
      updatedAt: now
    };

    const draftFile = this.#draftFilePath(normalizedPath);
    await fs.writeFile(draftFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");

    this.logger.info("Draft saved", {
      event: "draft_save",
      path: normalizedPath,
      owner: ownerName
    });

    return { ok: true, draft: record };
  }

  async deleteDraft(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Draft path is required." };
    }

    const draftFile = this.#draftFilePath(normalizedPath);
    const existed = await exists(draftFile);

    await fs.unlink(draftFile).catch(() => {});
    if (existed) {
      this.logger.info("Draft deleted", {
        event: "draft_delete",
        path: normalizedPath
      });
    }

    return { ok: true, deleted: existed };
  }

  async deleteDraftsByOwner(username) {
    const normalizedTarget = normalizeUsername(username);
    if (!normalizedTarget) {
      return 0;
    }

    let removed = 0;
    const files = await this.#listDraftFiles();
    for (const file of files) {
      const filePath = path.join(this.draftsDir, file);
      const record = await readDraftRecord(filePath);
      if (!record || normalizeUsername(record.owner) !== normalizedTarget) {
        continue;
      }

      await fs.unlink(filePath).catch(() => {});
      removed += 1;
    }

    this.logger.info("Drafts deleted for user", {
      event: "draft_delete_user",
      username,
      deletedDrafts: removed
    });

    return removed;
  }

  async deleteDraftsByPathPrefix(pathInput) {
    const normalizedPrefix = normalizeKbRelativePath(pathInput);
    if (!normalizedPrefix) {
      return { ok: false, deleted: 0, message: "Draft path is required." };
    }

    try {
      let deleted = 0;
      const files = await this.#listDraftFiles();
      for (const file of files) {
        const filePath = path.join(this.draftsDir, file);
        const record = await readDraftRecord(filePath);
        if (!record || !matchesPathPrefix(record.path, normalizedPrefix)) {
          continue;
        }

        await fs.unlink(filePath).catch(() => {});
        deleted += 1;
      }

      this.logger.info("Drafts deleted for KB path", {
        event: "draft_delete_path",
        path: normalizedPrefix,
        deletedDrafts: deleted
      });

      return { ok: true, deleted };
    } catch (error) {
      this.logger.error("Draft path cleanup failed", {
        event: "draft_delete_path_error",
        path: normalizedPrefix,
        error: error.message
      });
      return { ok: false, deleted: 0, message: "Draft cleanup failed." };
    }
  }

  async moveDraftsByPathPrefix(oldPathInput, newPathInput) {
    const oldPrefix = normalizeKbRelativePath(oldPathInput);
    const newPrefix = normalizeKbRelativePath(newPathInput);
    if (!oldPrefix || !newPrefix) {
      return { ok: false, moved: 0, message: "Old and new draft paths are required." };
    }

    if (oldPrefix === newPrefix) {
      return { ok: true, moved: 0 };
    }

    try {
      let moved = 0;
      const now = new Date().toISOString();
      const files = await this.#listDraftFiles();

      for (const file of files) {
        const sourceFile = path.join(this.draftsDir, file);
        const record = await readDraftRecord(sourceFile);
        if (!record || !matchesPathPrefix(record.path, oldPrefix)) {
          continue;
        }

        const suffix = record.path === oldPrefix ? "" : record.path.slice(oldPrefix.length + 1);
        const nextPath = normalizeKbRelativePath(suffix ? `${newPrefix}/${suffix}` : newPrefix);
        if (!nextPath) {
          continue;
        }

        const nextRecord = {
          path: nextPath,
          owner: record.owner,
          content: record.content,
          createdAt: record.createdAt || now,
          updatedAt: now
        };

        const targetFile = this.#draftFilePath(nextPath);
        await fs.writeFile(targetFile, `${JSON.stringify(nextRecord, null, 2)}\n`, "utf8");

        if (targetFile !== sourceFile) {
          await fs.unlink(sourceFile).catch(() => {});
        }

        moved += 1;
      }

      this.logger.info("Drafts moved for KB rename", {
        event: "draft_move_path",
        fromPath: oldPrefix,
        toPath: newPrefix,
        movedDrafts: moved
      });

      return { ok: true, moved };
    } catch (error) {
      this.logger.error("Draft migration failed", {
        event: "draft_move_path_error",
        fromPath: oldPrefix,
        toPath: newPrefix,
        error: error.message
      });
      return { ok: false, moved: 0, message: "Draft migration failed." };
    }
  }

  async #listDraftFiles() {
    const files = await fs.readdir(this.draftsDir).catch(() => []);
    return files.filter((file) => file.endsWith(".json"));
  }

  #draftFilePath(normalizedKbPath) {
    const encoded = encodePath(normalizedKbPath);
    return path.join(this.draftsDir, `${encoded}.json`);
  }
}

async function readDraftRecord(filePath, fallbackPath = "") {
  const raw = await fs.readFile(filePath, "utf8").catch(() => null);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const pathFromRecord = normalizeKbRelativePath(parsed.path || fallbackPath || decodePathFromFile(filePath));
    if (!pathFromRecord) {
      return null;
    }

    return {
      path: pathFromRecord,
      owner: String(parsed.owner || "").trim() || null,
      content: String(parsed.content || ""),
      createdAt: parsed.createdAt || null,
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return null;
  }
}

function decodePathFromFile(filePath) {
  const base = path.basename(filePath, ".json");
  try {
    return Buffer.from(base, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function matchesPathPrefix(candidatePath, prefix) {
  return candidatePath === prefix || candidatePath.startsWith(`${prefix}/`);
}

function encodePath(value) {
  return Buffer.from(value, "utf8").toString("base64url");
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
  DraftService
};
