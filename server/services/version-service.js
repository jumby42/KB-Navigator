const crypto = require("crypto");
const fs = require("fs/promises");
const { normalizeKbRelativePath } = require("../utils/path-utils");
const { writeFileAtomic } = require("../utils/fs-utils");

const MAX_VERSIONS_PER_NODE_TYPE = 200;
const VERSION_STORE_CACHE_TTL_MS = 1500;

class VersionService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.versionsFile = config.paths.versionsFileAbsolute;
    this.storeMutationQueue = Promise.resolve();
    this.storeCache = null;
    this.storeCacheExpiresAt = 0;
    this.storeCacheTtlMs = VERSION_STORE_CACHE_TTL_MS;
  }

  async listSnapshots(kbPathInput, nodeTypeInput) {
    const kbPath = normalizeKbRelativePath(kbPathInput);
    const nodeType = normalizeNodeType(nodeTypeInput);
    if (!kbPath || !nodeType) {
      return [];
    }

    const store = await this.#readStore();
    const bucket = getBucket(store, kbPath);
    return [...bucket[nodeType]]
      .reverse()
      .map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
        reason: entry.reason,
        contentLength: String(entry.content || "").length,
        contentPreview: buildPreview(entry.content, nodeType)
      }));
  }

  async getSnapshot(kbPathInput, nodeTypeInput, versionIdInput) {
    const kbPath = normalizeKbRelativePath(kbPathInput);
    const nodeType = normalizeNodeType(nodeTypeInput);
    const versionId = String(versionIdInput || "").trim();
    if (!kbPath || !nodeType || !versionId) {
      return null;
    }

    const store = await this.#readStore();
    const bucket = getBucket(store, kbPath);
    const entry = bucket[nodeType].find((item) => item.id === versionId);
    return entry ? { ...entry } : null;
  }

  async deleteSnapshot(kbPathInput, nodeTypeInput, versionIdInput) {
    return this.#runStoreMutation(async () => {
      const kbPath = normalizeKbRelativePath(kbPathInput);
      const nodeType = normalizeNodeType(nodeTypeInput);
      const versionId = String(versionIdInput || "").trim();
      if (!kbPath || !nodeType || !versionId) {
        return { ok: false, message: "Invalid path, node type, or version id." };
      }

      const store = await this.#readStore({ mutable: true });
      const bucket = ensureBucket(store, kbPath);
      const beforeCount = bucket[nodeType].length;

      bucket[nodeType] = bucket[nodeType].filter((item) => item.id !== versionId);
      const deleted = beforeCount - bucket[nodeType].length;
      if (deleted <= 0) {
        return { ok: false, message: "Version not found." };
      }

      if (bucket.question.length === 0 && bucket.solution.length === 0) {
        delete store.paths[kbPath];
      }

      await this.#writeStore(store);
      return { ok: true, deleted };
    });
  }

  async recordSnapshot({ kbPathInput, nodeTypeInput, contentInput, actorInput, reasonInput }) {
    return this.#runStoreMutation(async () => {
      const kbPath = normalizeKbRelativePath(kbPathInput);
      const nodeType = normalizeNodeType(nodeTypeInput);
      if (!kbPath || !nodeType) {
        return { ok: false, message: "Invalid path or node type." };
      }

      const content = String(contentInput || "");
      const actor = normalizeActor(actorInput);
      const reason = normalizeReason(reasonInput);

      const store = await this.#readStore({ mutable: true });
      const bucket = ensureBucket(store, kbPath);
      const now = new Date().toISOString();

      bucket[nodeType].push({
        id: buildVersionId(),
        createdAt: now,
        createdBy: actor,
        reason,
        content
      });

      if (bucket[nodeType].length > MAX_VERSIONS_PER_NODE_TYPE) {
        bucket[nodeType] = bucket[nodeType].slice(-MAX_VERSIONS_PER_NODE_TYPE);
      }

      await this.#writeStore(store);
      return { ok: true };
    });
  }

  async moveSnapshotsByPathPrefix(oldPathInput, newPathInput) {
    return this.#runStoreMutation(async () => {
      const oldPath = normalizeKbRelativePath(oldPathInput);
      const newPath = normalizeKbRelativePath(newPathInput);
      if (!oldPath || !newPath || oldPath === newPath) {
        return { ok: true, moved: 0 };
      }

      const store = await this.#readStore({ mutable: true });
      const keys = Object.keys(store.paths || {});
      let moved = 0;

      for (const key of keys) {
        if (!(key === oldPath || key.startsWith(`${oldPath}/`))) {
          continue;
        }

        const suffix = key === oldPath ? "" : key.slice(oldPath.length);
        const targetKey = `${newPath}${suffix}`;
        const sourceBucket = ensureBucket(store, key);
        const targetBucket = ensureBucket(store, targetKey);

        targetBucket.question = [...targetBucket.question, ...sourceBucket.question].slice(-MAX_VERSIONS_PER_NODE_TYPE);
        targetBucket.solution = [...targetBucket.solution, ...sourceBucket.solution].slice(-MAX_VERSIONS_PER_NODE_TYPE);

        if (key !== targetKey) {
          delete store.paths[key];
        }

        moved += 1;
      }

      if (moved > 0) {
        await this.#writeStore(store);
      }

      return { ok: true, moved };
    });
  }

  async deleteSnapshotsByPathPrefix(pathInput) {
    return this.#runStoreMutation(async () => {
      const prefix = normalizeKbRelativePath(pathInput);
      if (!prefix) {
        return { ok: true, deleted: 0 };
      }

      const store = await this.#readStore({ mutable: true });
      const keys = Object.keys(store.paths || {});
      let deleted = 0;

      for (const key of keys) {
        if (key === prefix || key.startsWith(`${prefix}/`)) {
          delete store.paths[key];
          deleted += 1;
        }
      }

      if (deleted > 0) {
        await this.#writeStore(store);
      }

      return { ok: true, deleted };
    });
  }

  #runStoreMutation(action) {
    const run = this.storeMutationQueue.then(() => action(), () => action());
    this.storeMutationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  #ensureStoreShape(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return { paths: {} };
    }

    const paths = parsed.paths && typeof parsed.paths === "object" ? parsed.paths : {};
    const cleaned = { paths: {} };

    for (const [key, value] of Object.entries(paths)) {
      const normalizedPath = normalizeKbRelativePath(key);
      if (!normalizedPath) {
        continue;
      }

      const bucket = normalizeBucket(value);
      if (bucket.question.length === 0 && bucket.solution.length === 0) {
        continue;
      }
      cleaned.paths[normalizedPath] = bucket;
    }

    return cleaned;
  }

  async #readStore(options = {}) {
    const mutable = Boolean(options.mutable);
    const bypassCache = Boolean(options.bypassCache);
    const now = Date.now();

    if (!bypassCache && this.storeCache && now <= this.storeCacheExpiresAt) {
      return mutable ? structuredClone(this.storeCache) : this.storeCache;
    }

    const raw = await fs.readFile(this.versionsFile, "utf8").catch(() => "");
    if (!raw.trim()) {
      const emptyStore = { paths: {} };
      this.#setStoreCache(emptyStore);
      return mutable ? structuredClone(emptyStore) : emptyStore;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const emptyStore = { paths: {} };
      this.#setStoreCache(emptyStore);
      return mutable ? structuredClone(emptyStore) : emptyStore;
    }

    const normalized = this.#ensureStoreShape(parsed);
    this.#setStoreCache(normalized);
    return mutable ? structuredClone(normalized) : normalized;
  }

  async #writeStore(storeInput) {
    const store = this.#ensureStoreShape(storeInput);
    const payload = `${JSON.stringify(store, null, 2)}\n`;
    await writeFileAtomic(this.versionsFile, payload, "utf8");
    this.#setStoreCache(store);
  }

  #setStoreCache(storeInput) {
    this.storeCache = this.#ensureStoreShape(storeInput);
    this.storeCacheExpiresAt = Date.now() + this.storeCacheTtlMs;
  }
}

function normalizeNodeType(value) {
  const candidate = String(value || "").trim().toLowerCase();
  if (candidate === "question" || candidate === "solution") {
    return candidate;
  }
  return "";
}

function normalizeActor(value) {
  const candidate = String(value || "").trim();
  return candidate || "system";
}

function normalizeReason(value) {
  const candidate = String(value || "").trim().toLowerCase();
  return candidate || "snapshot";
}

function normalizeBucket(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    question: normalizeEntryList(src.question),
    solution: normalizeEntryList(src.solution)
  };
}

function normalizeEntryList(value) {
  const list = Array.isArray(value) ? value : [];
  const output = [];

  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = String(item.id || "").trim();
    const createdAt = String(item.createdAt || "").trim();
    const createdBy = normalizeActor(item.createdBy);
    const reason = normalizeReason(item.reason);
    const content = String(item.content || "");

    if (!id || !createdAt) {
      continue;
    }

    output.push({
      id,
      createdAt,
      createdBy,
      reason,
      content
    });
  }

  return output.slice(-MAX_VERSIONS_PER_NODE_TYPE);
}

function ensureBucket(store, kbPath) {
  if (!store.paths || typeof store.paths !== "object") {
    store.paths = {};
  }

  if (!store.paths[kbPath]) {
    store.paths[kbPath] = {
      question: [],
      solution: []
    };
  }

  if (!Array.isArray(store.paths[kbPath].question)) {
    store.paths[kbPath].question = [];
  }

  if (!Array.isArray(store.paths[kbPath].solution)) {
    store.paths[kbPath].solution = [];
  }

  return store.paths[kbPath];
}

function getBucket(store, kbPath) {
  if (!store || !store.paths || typeof store.paths !== "object") {
    return { question: [], solution: [] };
  }

  const raw = store.paths[kbPath];
  if (!raw || typeof raw !== "object") {
    return { question: [], solution: [] };
  }

  return {
    question: Array.isArray(raw.question) ? raw.question : [],
    solution: Array.isArray(raw.solution) ? raw.solution : []
  };
}

function buildPreview(contentInput, nodeType) {
  const content = String(contentInput || "");
  const plain = nodeType === "solution" ? content.replace(/<[^>]*>/g, " ") : content;
  const compact = plain.replace(/\s+/g, " ").trim();
  return compact.slice(0, 140);
}

function buildVersionId() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
}

module.exports = {
  VersionService
};
