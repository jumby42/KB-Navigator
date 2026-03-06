const fs = require("fs/promises");
const path = require("path");
const { normalizeKbRelativePath, resolveKbPath } = require("../utils/path-utils");

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_PAGE_SIZE_DEFAULT = 25;
const SEARCH_PAGE_SIZE_MAX = 25;
const SEARCH_MAX_TEXT_TOKENS = 1800;
const SEARCH_SNIPPET_RADIUS = 90;
const SEARCH_RESULT_CACHE_TTL_MS = 30000;
const SEARCH_RESULT_CACHE_MAX_ENTRIES = 500;
const SEARCH_TOKEN_INDEX_TEXT_LIMIT = 220;
const READ_NODE_CACHE_TTL_MS = 8000;
const READ_NODE_CACHE_MAX_ENTRIES = 8000;
const TOPICS_CACHE_TTL_MS = 30000;
const READ_NODE_CHILD_CONCURRENCY = 16;
const SEARCH_SCAN_CONCURRENCY = 12;
const SOLUTION_WALK_CONCURRENCY = 12;
const FLAG_MARKER_NAME_PATTERN = /^\.[a-z0-9][a-z0-9_-]*$/;

class KBService {
  constructor(config, logger, sanitizeService, flagService) {
    this.config = config;
    this.logger = logger;
    this.sanitizeService = sanitizeService;
    this.flagService = flagService;
    this.searchIndex = new Map();
    this.searchIndexReady = false;
    this.searchIndexDirty = true;
    this.searchIndexBuiltAt = null;
    this.searchIndexMutationQueue = Promise.resolve();
    this.searchResultCache = new Map();
    this.searchResultCacheTtlMs = SEARCH_RESULT_CACHE_TTL_MS;
    this.searchResultCacheMaxEntries = SEARCH_RESULT_CACHE_MAX_ENTRIES;
    this.searchTokenIndex = new Map();
    this.searchTokenIndexDirty = true;
    this.readNodeCache = new Map();
    this.readNodeCacheTtlMs = READ_NODE_CACHE_TTL_MS;
    this.readNodeCacheMaxEntries = READ_NODE_CACHE_MAX_ENTRIES;
    this.topicsCache = null;
    this.topicsCacheExpiresAt = 0;
  }

  async listTopics() {
    const now = Date.now();
    if (this.topicsCache && now <= this.topicsCacheExpiresAt) {
      return structuredClone(this.topicsCache);
    }

    const entries = await this.#listChildFolders(this.config.paths.kbRootAbsolute);
    const topics = entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "_trash")
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((entry) => ({
        label: entry.name,
        path: entry.name
      }));

    const response = { ok: true, topics };
    this.topicsCache = structuredClone(response);
    this.topicsCacheExpiresAt = now + TOPICS_CACHE_TTL_MS;
    return response;
  }

  async initializeSearchIndex() {
    try {
      await this.rebuildSearchIndex("startup");
    } catch (error) {
      this.logger.warn("Search index startup build failed", {
        event: "search_index_startup_error",
        error: error.message
      });
    }
  }

  markSearchIndexDirty(reason = "") {
    this.searchIndexDirty = true;
    this.#clearSearchResultCache();
    this.#clearReadCaches();
    this.#markSearchTokenIndexDirty();
    if (!reason) {
      return;
    }

    this.logger.info("Search index marked dirty", {
      event: "search_index_mark_dirty",
      reason
    });
  }

  markReadCacheDirty(reason = "manual") {
    const nodeEntries = this.readNodeCache.size;
    const topicsCached = Boolean(this.topicsCache);
    this.#clearReadCaches();

    if (reason) {
      this.logger.info("Read cache cleared", {
        event: "read_cache_clear",
        reason
      });
    }

    return {
      ok: true,
      nodeEntries,
      topicsCached
    };
  }

  getReadCacheStatus() {
    return {
      ok: true,
      nodeEntries: this.readNodeCache.size,
      topicsCached: Boolean(this.topicsCache),
      topicsExpiresAt: this.topicsCache ? new Date(this.topicsCacheExpiresAt).toISOString() : null
    };
  }

  clearSearchResultCache(reason = "manual") {
    this.#clearSearchResultCache();
    this.#clearReadCaches();

    if (reason) {
      this.logger.info("Search cache cleared", {
        event: "search_cache_clear",
        reason
      });
    }

    return {
      ok: true,
      cacheEntries: this.searchResultCache.size
    };
  }

  getSearchIndexStatus() {
    return {
      ok: true,
      ready: this.searchIndexReady,
      dirty: this.searchIndexDirty,
      solutions: this.searchIndex.size,
      builtAt: this.searchIndexBuiltAt,
      queryCacheEntries: this.searchResultCache.size
    };
  }

  async rebuildSearchIndex(reason = "manual") {
    return this.#runSearchIndexMutation(() => this.#rebuildSearchIndexUnlocked(reason));
  }

  async upsertSearchIndexPath(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    return this.#runSearchIndexMutation(async () => {
      if (!this.searchIndexReady || this.searchIndexDirty) {
        await this.#rebuildSearchIndexUnlocked("upsert-before-ready");
      }

      const resolved = resolveKbPath(this.config.paths.kbRootAbsolute, normalizedPath);
      const stats = await fs.stat(resolved.absolute).catch(() => null);
      if (!stats || !stats.isDirectory()) {
        this.searchIndex.delete(normalizedPath);
        this.searchIndexBuiltAt = new Date().toISOString();
        this.#clearSearchResultCache();
        this.#clearReadCaches();
        this.#markSearchTokenIndexDirty();
        return { ok: true, updated: false, removed: true };
      }

      const entries = await fs.readdir(resolved.absolute, { withFileTypes: true }).catch(() => []);
      const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
      if (!fileNames.includes("solution.html")) {
        this.searchIndex.delete(normalizedPath);
        this.searchIndexBuiltAt = new Date().toISOString();
        this.#clearSearchResultCache();
        this.#clearReadCaches();
        this.#markSearchTokenIndexDirty();
        return { ok: true, updated: false, removed: true };
      }

      const label = path.basename(resolved.relative);
      const doc = await this.#buildSearchDoc(resolved.absolute, resolved.relative, label, fileNames);
      if (!doc) {
        this.searchIndex.delete(normalizedPath);
        this.searchIndexBuiltAt = new Date().toISOString();
        this.#clearSearchResultCache();
        this.#clearReadCaches();
        this.#markSearchTokenIndexDirty();
        return { ok: true, updated: false, removed: true };
      }

      this.searchIndex.set(normalizedPath, doc);
      this.searchIndexBuiltAt = new Date().toISOString();
      this.searchIndexDirty = false;
      this.#clearSearchResultCache();
      this.#clearReadCaches();
      this.#markSearchTokenIndexDirty();
      return { ok: true, updated: true, removed: false };
    });
  }

  async removeSearchIndexPathPrefix(pathInput) {
    const normalizedPrefix = normalizeKbRelativePath(pathInput);
    if (!normalizedPrefix) {
      return { ok: false, message: "Path prefix is required." };
    }

    return this.#runSearchIndexMutation(async () => {
      if (!this.searchIndexReady || this.searchIndexDirty) {
        await this.#rebuildSearchIndexUnlocked("remove-prefix-before-ready");
      }

      let removed = 0;
      for (const key of Array.from(this.searchIndex.keys())) {
        if (key === normalizedPrefix || key.startsWith(`${normalizedPrefix}/`)) {
          this.searchIndex.delete(key);
          removed += 1;
        }
      }

      if (removed > 0) {
        this.searchIndexBuiltAt = new Date().toISOString();
        this.#clearSearchResultCache();
        this.#clearReadCaches();
        this.#markSearchTokenIndexDirty();
      }
      this.searchIndexDirty = false;
      return { ok: true, removed };
    });
  }

  async renameSearchIndexPathPrefix(oldPathInput, newPathInput) {
    const oldPrefix = normalizeKbRelativePath(oldPathInput);
    const newPrefix = normalizeKbRelativePath(newPathInput);
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
      return { ok: true, moved: 0 };
    }

    return this.#runSearchIndexMutation(async () => {
      if (!this.searchIndexReady || this.searchIndexDirty) {
        await this.#rebuildSearchIndexUnlocked("rename-prefix-before-ready");
      }

      const updates = [];
      for (const [key, value] of this.searchIndex.entries()) {
        if (!(key === oldPrefix || key.startsWith(`${oldPrefix}/`))) {
          continue;
        }

        const suffix = key === oldPrefix ? "" : key.slice(oldPrefix.length + 1);
        const nextPath = normalizeKbRelativePath(suffix ? `${newPrefix}/${suffix}` : newPrefix);
        if (!nextPath) {
          continue;
        }

        updates.push({ from: key, to: nextPath, doc: value });
      }

      for (const update of updates) {
        this.searchIndex.delete(update.from);
      }

      for (const update of updates) {
        const nextLabel = path.basename(update.to);
        this.searchIndex.set(update.to, {
          ...update.doc,
          path: update.to,
          label: nextLabel,
          labelNormalized: normalizeSearchText(nextLabel),
          labelWords: tokenizeWords(nextLabel)
        });
      }

      if (updates.length > 0) {
        this.searchIndexBuiltAt = new Date().toISOString();
        this.#clearSearchResultCache();
        this.#clearReadCaches();
        this.#markSearchTokenIndexDirty();
      }
      this.searchIndexDirty = false;
      return { ok: true, moved: updates.length };
    });
  }

  async countSolutions() {
    try {
      await this.#ensureSearchIndex();
      return this.searchIndex.size;
    } catch (error) {
      this.logger.warn("Search index unavailable for count; using filesystem fallback", {
        event: "search_index_count_fallback",
        error: error.message
      });
      const solutionFolders = await this.#listSolutionFolders();
      return solutionFolders.length;
    }
  }

  async readNode(kbRelativePath, authContext = null) {
    try {
      const normalized = normalizeKbRelativePath(kbRelativePath);
      if (!normalized) {
        return this.#missing();
      }

      const readCacheKey = this.#buildReadNodeCacheKey(normalized, authContext);
      const cached = this.#readReadNodeCache(readCacheKey);
      if (cached) {
        return cached;
      }

      const cacheAndReturn = (response) => {
        this.#writeReadNodeCache(readCacheKey, response);
        return response;
      };

      const resolved = resolveKbPath(this.config.paths.kbRootAbsolute, normalized);
      const stats = await fs.stat(resolved.absolute).catch(() => null);
      if (!stats || !stats.isDirectory()) {
        return cacheAndReturn(this.#missing());
      }

      const questionPath = path.join(resolved.absolute, "question.txt");
      const solutionPath = path.join(resolved.absolute, "solution.html");
      const canUseIndex = this.searchIndexReady && !this.searchIndexDirty;
      const indexedCurrent = canUseIndex ? this.searchIndex.get(resolved.relative) : null;
      const hasSolution = Boolean(indexedCurrent) || await exists(solutionPath);

      if (hasSolution) {
        const terminal = await this.#readTerminal(resolved.relative, resolved.absolute, authContext);
        return cacheAndReturn(terminal);
      }

      const hasQuestion = await exists(questionPath);
      if (!hasQuestion) {
        return cacheAndReturn(this.#missing());
      }

      const question = await fs.readFile(questionPath, "utf8");
      const childFolders = await this.#listChildFolders(resolved.absolute);
      const definitions = await this.flagService.listDefinitions();
      const definitionMap = new Map(definitions.map((entry) => [String(entry.name || "").toLowerCase(), entry]));

      const answers = (await mapWithConcurrency(
        childFolders,
        READ_NODE_CHILD_CONCURRENCY,
        async (folder) => {
          if (!folder || folder.name.startsWith(".")) {
            return null;
          }

          const childAbsolute = path.join(resolved.absolute, folder.name);
          const childRelative = normalizeKbRelativePath(`${resolved.relative}/${folder.name}`);
          const indexed = canUseIndex ? this.searchIndex.get(childRelative) : null;
          const childHasSolution = Boolean(indexed) || await exists(path.join(childAbsolute, "solution.html"));

          let appliedFlags = [];
          if (childHasSolution && indexed) {
            appliedFlags = (Array.isArray(indexed.markerNames)
              ? indexed.markerNames.map((name) => definitionMap.get(name)).filter(Boolean)
              : []);
          } else if (childHasSolution) {
            appliedFlags = await this.flagService.listAppliedFlags(childAbsolute, definitions);
          }

          const access = this.flagService.evaluateAccess(appliedFlags, authContext);

          return {
            label: folder.name,
            path: childRelative,
            terminal: childHasSolution,
            restricted: Boolean(childHasSolution && access.restricted),
            blockingFlag: access.blockingFlag ? toPublicFlag(access.blockingFlag) : null,
            flags: appliedFlags.map(toPublicFlag)
          };
        }
      )).filter(Boolean);

      answers.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

      return cacheAndReturn({
        ok: true,
        type: "node",
        path: resolved.relative,
        question: question.trim(),
        answers
      });
    } catch (error) {
      this.logger.error("KB read node failed", {
        event: "kb_read_error",
        path: String(kbRelativePath || ""),
        error: error.message
      });
      return this.#missing();
    }
  }

  async searchSolutions(queryInput, options = {}, authContext = null) {
    const queryRaw = String(queryInput || "").trim();
    const queryNormalized = normalizeSearchText(queryRaw);
    const requestedPage = parsePositiveInt(options.page, 1);
    const requestedPageSize = parsePositiveInt(options.pageSize, SEARCH_PAGE_SIZE_DEFAULT);
    const pageSize = Math.min(SEARCH_PAGE_SIZE_MAX, Math.max(1, requestedPageSize));

    if (queryNormalized.length < SEARCH_MIN_QUERY_LENGTH) {
      return {
        ok: true,
        query: queryRaw,
        page: 1,
        pageSize,
        total: 0,
        totalPages: 0,
        hasPrevPage: false,
        hasNextPage: false,
        results: []
      };
    }

    try {
      await this.#ensureSearchIndex();
    } catch (error) {
      this.logger.warn("Search index unavailable; attempting rebuild fallback", {
        event: "search_index_rebuild_fallback",
        error: error.message
      });
      try {
        await this.rebuildSearchIndex("search-fallback");
      } catch (rebuildError) {
        this.logger.error("Search fallback rebuild failed", {
          event: "search_index_rebuild_failed",
          error: rebuildError.message
        });
        return {
          ok: true,
          query: queryRaw,
          page: 1,
          pageSize,
          total: 0,
          totalPages: 0,
          hasPrevPage: false,
          hasNextPage: false,
          results: []
        };
      }
    }

    const searchCacheKey = this.#buildSearchCacheKey(queryNormalized, requestedPage, pageSize, authContext);
    const cachedResponse = this.#readSearchCache(searchCacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const queryTokens = tokenizeWords(queryNormalized);
    const candidateDocPaths = this.#collectCandidateDocPaths(queryNormalized, queryTokens);
    const definitions = await this.flagService.listDefinitions();
    const definitionMap = new Map(definitions.map((entry) => [String(entry.name || "").toLowerCase(), entry]));
    const allMatches = [];

    const docsToScan = candidateDocPaths && candidateDocPaths.size > 0
      ? Array.from(candidateDocPaths).map((candidatePath) => this.searchIndex.get(candidatePath)).filter(Boolean)
      : this.searchIndex.values();

    for (const doc of docsToScan) {
      const appliedFlags = (Array.isArray(doc.markerNames) ? doc.markerNames : [])
        .map((name) => definitionMap.get(name))
        .filter(Boolean);
      const access = this.flagService.evaluateAccess(appliedFlags, authContext);
      if (access.restricted) {
        continue;
      }

      const rank = rankSearchHit({
        label: doc.label,
        solutionText: doc.solutionText,
        queryNormalized,
        queryTokens,
        labelNormalizedInput: doc.labelNormalized,
        labelWordsInput: doc.labelWords,
        textNormalizedInput: doc.textNormalized,
        textWordsInput: doc.textWords
      });

      if (!rank) {
        continue;
      }

      allMatches.push({
        path: doc.path,
        label: doc.label,
        type: "terminal",
        snippet: buildSnippet(doc.solutionText, rank.snippetTerm),
        highlightTerms: rank.highlightTerms,
        flags: appliedFlags.map(toPublicFlag),
        _bucket: rank.bucket,
        _distance: rank.distance,
        _position: rank.position
      });
    }

    allMatches.sort((a, b) => {
      if (a._bucket !== b._bucket) {
        return a._bucket - b._bucket;
      }
      if (a._distance !== b._distance) {
        return a._distance - b._distance;
      }
      if (a._position !== b._position) {
        return a._position - b._position;
      }
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });

    const total = allMatches.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(totalPages, Math.max(1, requestedPage));
    const startIndex = totalPages === 0 ? 0 : (page - 1) * pageSize;
    const pageItems = allMatches.slice(startIndex, startIndex + pageSize).map((entry) => ({
      path: entry.path,
      label: entry.label,
      type: entry.type,
      snippet: entry.snippet,
      highlightTerms: entry.highlightTerms,
      flags: entry.flags
    }));

    const response = {
      ok: true,
      query: queryRaw,
      page,
      pageSize,
      total,
      totalPages,
      hasPrevPage: totalPages > 0 && page > 1,
      hasNextPage: totalPages > 0 && page < totalPages,
      results: pageItems
    };

    this.#writeSearchCache(searchCacheKey, response);
    return response;
  }

  async #ensureSearchIndex() {
    if (this.searchIndexReady && !this.searchIndexDirty) {
      return;
    }

    await this.rebuildSearchIndex(this.searchIndexReady ? "dirty-rebuild" : "initial-build");
  }

  async #rebuildSearchIndexUnlocked(reason = "manual") {
    const docs = [];
    await this.#scanDirectoryForSearch(this.config.paths.kbRootAbsolute, "", docs);

    const nextIndex = new Map();
    for (const doc of docs) {
      nextIndex.set(doc.path, doc);
    }

    this.searchIndex = nextIndex;
    this.searchIndexReady = true;
    this.searchIndexDirty = false;
    this.searchIndexBuiltAt = new Date().toISOString();
    this.#clearSearchResultCache();
    this.#clearReadCaches();
    this.#markSearchTokenIndexDirty();

    this.logger.info("Search index rebuilt", {
      event: "search_index_rebuild",
      reason,
      solutions: this.searchIndex.size,
      builtAt: this.searchIndexBuiltAt
    });

    return {
      ok: true,
      reason,
      solutions: this.searchIndex.size,
      builtAt: this.searchIndexBuiltAt
    };
  }

  #runSearchIndexMutation(action) {
    const run = this.searchIndexMutationQueue.then(() => action(), () => action());
    this.searchIndexMutationQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  #markSearchTokenIndexDirty() {
    this.searchTokenIndexDirty = true;
    if (this.searchTokenIndex.size > 0) {
      this.searchTokenIndex.clear();
    }
  }

  #ensureSearchTokenIndex() {
    if (!this.searchTokenIndexDirty) {
      return;
    }

    this.#rebuildSearchTokenIndex();
  }

  #rebuildSearchTokenIndex() {
    const nextTokenIndex = new Map();

    for (const [docPath, doc] of this.searchIndex.entries()) {
      const labelTokens = Array.isArray(doc.labelWords) ? doc.labelWords : [];
      const textTokens = Array.isArray(doc.textWords)
        ? doc.textWords.slice(0, SEARCH_TOKEN_INDEX_TEXT_LIMIT)
        : [];
      const allTokens = [...labelTokens, ...textTokens];

      for (const token of allTokens) {
        const normalizedToken = String(token || "").trim().toLowerCase();
        if (!normalizedToken || normalizedToken.length < SEARCH_MIN_QUERY_LENGTH) {
          continue;
        }

        if (!nextTokenIndex.has(normalizedToken)) {
          nextTokenIndex.set(normalizedToken, new Set());
        }
        nextTokenIndex.get(normalizedToken).add(docPath);
      }
    }

    this.searchTokenIndex = nextTokenIndex;
    this.searchTokenIndexDirty = false;
  }

  #collectCandidateDocPaths(queryNormalized, queryTokens) {
    this.#ensureSearchTokenIndex();

    const tokens = Array.isArray(queryTokens)
      ? queryTokens.map((token) => String(token || "").trim().toLowerCase()).filter(Boolean)
      : [];

    if (!tokens.length || this.searchTokenIndex.size === 0) {
      return null;
    }

    const candidateSet = new Set();
    for (const token of tokens) {
      const postings = this.searchTokenIndex.get(token);
      if (!postings || postings.size === 0) {
        continue;
      }
      for (const docPath of postings) {
        candidateSet.add(docPath);
      }
    }

    for (const [docPath, doc] of this.searchIndex.entries()) {
      const labelNormalized = String(doc && doc.labelNormalized ? doc.labelNormalized : "").trim().toLowerCase();
      if (!labelNormalized) {
        continue;
      }

      if (labelNormalized.includes(queryNormalized)) {
        candidateSet.add(docPath);
        continue;
      }

      const labelWords = Array.isArray(doc && doc.labelWords) ? doc.labelWords : [];
      if (!labelWords.length) {
        continue;
      }

      const fuzzyName = findBestFuzzyMatch(tokens, labelWords);
      if (fuzzyName) {
        candidateSet.add(docPath);
      }
    }

    if (candidateSet.size === 0 || candidateSet.size >= this.searchIndex.size) {
      return null;
    }

    return candidateSet;
  }

  #buildReadNodeCacheKey(normalizedPath, authContext) {
    const authSignature = buildAuthSignature(authContext);
    return `${normalizedPath}|${authSignature}`;
  }

  #readReadNodeCache(cacheKey) {
    const record = this.readNodeCache.get(cacheKey);
    if (!record) {
      return null;
    }

    if (Date.now() > record.expiresAt) {
      this.readNodeCache.delete(cacheKey);
      return null;
    }

    return structuredClone(record.value);
  }

  #writeReadNodeCache(cacheKey, payload) {
    if (!cacheKey || !payload || payload.ok !== true) {
      return;
    }

    if (this.readNodeCache.size >= this.readNodeCacheMaxEntries) {
      const firstKey = this.readNodeCache.keys().next().value;
      if (firstKey) {
        this.readNodeCache.delete(firstKey);
      }
    }

    this.readNodeCache.set(cacheKey, {
      expiresAt: Date.now() + this.readNodeCacheTtlMs,
      value: structuredClone(payload)
    });
  }

  #clearReadCaches() {
    if (this.readNodeCache.size > 0) {
      this.readNodeCache.clear();
    }
    this.topicsCache = null;
    this.topicsCacheExpiresAt = 0;
  }

  #buildSearchCacheKey(queryNormalized, requestedPage, pageSize, authContext) {
    const authSignature = buildAuthSignature(authContext);
    const buildVersion = this.searchIndexBuiltAt || "none";
    return `${queryNormalized}|${requestedPage}|${pageSize}|${authSignature}|${buildVersion}`;
  }

  #readSearchCache(cacheKey) {
    const record = this.searchResultCache.get(cacheKey);
    if (!record) {
      return null;
    }

    if (Date.now() > record.expiresAt) {
      this.searchResultCache.delete(cacheKey);
      return null;
    }

    return structuredClone(record.value);
  }

  #writeSearchCache(cacheKey, payload) {
    if (!cacheKey) {
      return;
    }

    if (this.searchResultCache.size >= this.searchResultCacheMaxEntries) {
      const firstKey = this.searchResultCache.keys().next().value;
      if (firstKey) {
        this.searchResultCache.delete(firstKey);
      }
    }

    this.searchResultCache.set(cacheKey, {
      expiresAt: Date.now() + this.searchResultCacheTtlMs,
      value: structuredClone(payload)
    });
  }

  #clearSearchResultCache() {
    if (this.searchResultCache.size > 0) {
      this.searchResultCache.clear();
    }
  }

  async #scanDirectoryForSearch(absoluteFolderPath, relativeFolderPath, docs) {
    const entries = await fs.readdir(absoluteFolderPath, { withFileTypes: true }).catch(() => []);
    const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

    if (relativeFolderPath && fileNames.includes("solution.html")) {
      const label = path.basename(relativeFolderPath);
      const doc = await this.#buildSearchDoc(absoluteFolderPath, relativeFolderPath, label, fileNames);
      if (doc) {
        docs.push(doc);
      }
    }

    const childDirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => !(entry.name === "_trash" && !relativeFolderPath));

    await mapWithConcurrency(
      childDirs,
      SEARCH_SCAN_CONCURRENCY,
      async (entry) => {
        const childAbsolute = path.join(absoluteFolderPath, entry.name);
        const childRelative = relativeFolderPath ? `${relativeFolderPath}/${entry.name}` : entry.name;
        await this.#scanDirectoryForSearch(childAbsolute, childRelative, docs);
      }
    );
  }

  async #buildSearchDoc(absoluteFolderPath, relativeFolderPath, label, fileNamesInput = null) {
    const solutionPath = path.join(absoluteFolderPath, "solution.html");
    const rawHtml = await fs.readFile(solutionPath, "utf8").catch(() => "");
    const safeHtml = this.sanitizeService.sanitizeSolutionHtml(rawHtml);
    const solutionText = htmlToSearchText(safeHtml);

    let fileNames = Array.isArray(fileNamesInput) ? fileNamesInput : [];
    if (!Array.isArray(fileNamesInput)) {
      const entries = await fs.readdir(absoluteFolderPath, { withFileTypes: true }).catch(() => []);
      fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    }

    const markerNames = collectMarkerNames(fileNames);
    const labelValue = String(label || path.basename(relativeFolderPath) || "");
    const labelNormalized = normalizeSearchText(labelValue);

    return {
      path: relativeFolderPath,
      label: labelValue,
      labelNormalized,
      labelWords: tokenizeWords(labelNormalized),
      textNormalized: normalizeSearchText(solutionText),
      textWords: tokenizeWords(solutionText, SEARCH_MAX_TEXT_TOKENS),
      solutionText,
      markerNames
    };
  }

  async #readTerminal(relative, absolute, authContext) {
    const solutionPath = path.join(absolute, "solution.html");
    const definitions = await this.flagService.listDefinitions();

    let appliedFlags = [];
    const canUseIndex = this.searchIndexReady && !this.searchIndexDirty && this.searchIndex.has(relative);
    if (canUseIndex) {
      const indexed = this.searchIndex.get(relative);
      const definitionMap = new Map(definitions.map((entry) => [String(entry.name || "").toLowerCase(), entry]));
      appliedFlags = (indexed && Array.isArray(indexed.markerNames)
        ? indexed.markerNames.map((name) => definitionMap.get(name)).filter(Boolean)
        : []);
    } else {
      appliedFlags = await this.flagService.listAppliedFlags(absolute, definitions);
    }

    const access = this.flagService.evaluateAccess(appliedFlags, authContext);

    if (access.restricted) {
      const blockingFlag = access.blockingFlag ? toPublicFlag(access.blockingFlag) : null;
      return {
        ok: true,
        type: "terminal",
        path: relative,
        flags: appliedFlags.map(toPublicFlag),
        restricted: true,
        blockingFlag,
        message: blockingFlag && blockingFlag.message
          ? blockingFlag.message
          : "This solution is restricted at this time."
      };
    }

    const rawHtml = await fs.readFile(solutionPath, "utf8");
    const safeHtml = this.sanitizeService.sanitizeSolutionHtml(rawHtml);
    return {
      ok: true,
      type: "terminal",
      path: relative,
      flags: appliedFlags.map(toPublicFlag),
      restricted: false,
      solutionHtml: safeHtml,
      message: null
    };
  }

  async #listChildFolders(absoluteFolderPath) {
    const entries = await fs.readdir(absoluteFolderPath, { withFileTypes: true }).catch(() => []);
    return entries.filter((entry) => entry.isDirectory());
  }

  async #listSolutionFolders() {
    const folders = [];
    await this.#walkKbFolders(this.config.paths.kbRootAbsolute, "", folders);
    return folders;
  }

  async #walkKbFolders(absoluteFolderPath, relativeFolderPath, folders) {
    const entries = await fs.readdir(absoluteFolderPath, { withFileTypes: true }).catch(() => []);
    const childDirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => entry.name !== "_trash");

    await mapWithConcurrency(
      childDirs,
      SOLUTION_WALK_CONCURRENCY,
      async (entry) => {
        const childAbsolute = path.join(absoluteFolderPath, entry.name);
        const childRelative = relativeFolderPath ? `${relativeFolderPath}/${entry.name}` : entry.name;
        const hasSolution = await exists(path.join(childAbsolute, "solution.html"));
        if (hasSolution) {
          folders.push({
            absolute: childAbsolute,
            relative: childRelative,
            label: entry.name
          });
        }

        await this.#walkKbFolders(childAbsolute, childRelative, folders);
      }
    );
  }

  #missing() {
    return {
      ok: true,
      type: "missing",
      message: "No solution available."
    };
  }
}

function rankSearchHit({
  label,
  solutionText,
  queryNormalized,
  queryTokens,
  labelNormalizedInput = "",
  labelWordsInput = null,
  textNormalizedInput = "",
  textWordsInput = null
}) {
  const labelText = String(label || "").trim();
  const labelNormalized = labelNormalizedInput || normalizeSearchText(labelText);
  const textNormalized = textNormalizedInput || normalizeSearchText(solutionText);
  const labelWords = Array.isArray(labelWordsInput) ? labelWordsInput : tokenizeWords(labelNormalized);
  const textWords = Array.isArray(textWordsInput) ? textWordsInput : tokenizeWords(textNormalized, SEARCH_MAX_TEXT_TOKENS);

  if (!labelNormalized && !textNormalized) {
    return null;
  }

  if (labelNormalized === queryNormalized) {
    return {
      bucket: 0,
      distance: 0,
      position: 0,
      snippetTerm: queryNormalized,
      highlightTerms: limitTerms([queryNormalized])
    };
  }

  const nameContainsIndex = labelNormalized.indexOf(queryNormalized);
  if (nameContainsIndex >= 0) {
    return {
      bucket: 1,
      distance: 0,
      position: nameContainsIndex,
      snippetTerm: queryNormalized,
      highlightTerms: limitTerms([queryNormalized])
    };
  }

  const fuzzyName = findBestFuzzyMatch(queryTokens, labelWords);
  if (fuzzyName) {
    return {
      bucket: 1,
      distance: fuzzyName.distance,
      position: labelNormalized.indexOf(fuzzyName.word),
      snippetTerm: fuzzyName.word,
      highlightTerms: limitTerms([fuzzyName.word])
    };
  }

  const textContainsIndex = textNormalized.indexOf(queryNormalized);
  if (textContainsIndex >= 0) {
    return {
      bucket: 2,
      distance: 0,
      position: textContainsIndex,
      snippetTerm: queryNormalized,
      highlightTerms: limitTerms([queryNormalized])
    };
  }

  const directTokenMatch = findBestTokenPresence(queryTokens, textWords);
  if (directTokenMatch) {
    return {
      bucket: 2,
      distance: 0,
      position: textNormalized.indexOf(directTokenMatch.word),
      snippetTerm: directTokenMatch.word,
      highlightTerms: limitTerms([directTokenMatch.word])
    };
  }

  const fuzzyText = findBestFuzzyMatch(queryTokens, textWords);
  if (fuzzyText) {
    return {
      bucket: 2,
      distance: fuzzyText.distance,
      position: textNormalized.indexOf(fuzzyText.word),
      snippetTerm: fuzzyText.word,
      highlightTerms: limitTerms([fuzzyText.word])
    };
  }

  return null;
}

function findBestTokenPresence(queryTokens, candidateWords) {
  const candidates = new Set(candidateWords);
  for (const token of queryTokens) {
    if (candidates.has(token)) {
      return { word: token };
    }
  }
  return null;
}

function findBestFuzzyMatch(queryTokens, candidateWords) {
  if (!queryTokens.length || !candidateWords.length) {
    return null;
  }

  let best = null;
  for (const token of queryTokens) {
    if (!token || token.length < SEARCH_MIN_QUERY_LENGTH) {
      continue;
    }

    const tolerance = typoTolerance(token);
    for (const word of candidateWords) {
      if (!word || Math.abs(word.length - token.length) > tolerance) {
        continue;
      }
      const distance = levenshteinDistance(token, word, tolerance);
      if (distance > tolerance) {
        continue;
      }
      if (!best || distance < best.distance || (distance === best.distance && word.length < best.word.length)) {
        best = { token, word, distance };
      }
    }
  }

  return best;
}

function typoTolerance(token) {
  if (token.length <= 4) {
    return 1;
  }
  if (token.length <= 10) {
    return 2;
  }
  return 3;
}

function levenshteinDistance(a, b, maxDistance) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  const rows = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    rows[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    let previous = i - 1;
    rows[0] = i;
    let smallestInRow = rows[0];

    for (let j = 1; j <= b.length; j += 1) {
      const current = rows[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[j] = Math.min(
        rows[j] + 1,
        rows[j - 1] + 1,
        previous + cost
      );
      previous = current;
      if (rows[j] < smallestInRow) {
        smallestInRow = rows[j];
      }
    }

    if (smallestInRow > maxDistance) {
      return maxDistance + 1;
    }
  }

  return rows[b.length];
}

function buildSnippet(solutionText, term) {
  const value = String(solutionText || "").trim();
  if (!value) {
    return "";
  }

  const lowerValue = value.toLowerCase();
  const searchTerm = String(term || "").toLowerCase().trim();
  let index = -1;
  if (searchTerm) {
    index = lowerValue.indexOf(searchTerm);
  }

  if (index < 0) {
    const fallback = value.slice(0, SEARCH_SNIPPET_RADIUS * 2).trim();
    return fallback.length < value.length ? `${fallback}...` : fallback;
  }

  const start = Math.max(0, index - SEARCH_SNIPPET_RADIUS);
  const end = Math.min(value.length, index + searchTerm.length + SEARCH_SNIPPET_RADIUS);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < value.length ? "..." : "";
  return `${prefix}${value.slice(start, end).trim()}${suffix}`;
}

function htmlToSearchText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeWords(value, limit = 400) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const matches = normalized.match(/[a-z0-9]+/g) || [];
  if (matches.length <= limit) {
    return matches;
  }
  return matches.slice(0, limit);
}

async function mapWithConcurrency(itemsInput, concurrencyInput, mapper) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (!items.length) {
    return [];
  }

  const worker = typeof mapper === "function" ? mapper : async (value) => value;
  const concurrency = Math.max(1, Math.min(Number(concurrencyInput) || 1, items.length));
  const results = new Array(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

function parsePositiveInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return Math.floor(numeric);
}

function limitTerms(terms) {
  const unique = [];
  for (const value of terms) {
    const candidate = String(value || "").trim().toLowerCase();
    if (!candidate) {
      continue;
    }
    if (!unique.includes(candidate)) {
      unique.push(candidate);
    }
    if (unique.length >= 6) {
      break;
    }
  }
  return unique;
}

function buildAuthSignature(authContext) {
  const isAuthenticated = Boolean(authContext && authContext.isAuthenticated);
  if (!isAuthenticated) {
    return "anon";
  }

  const role = authContext && authContext.role ? String(authContext.role).toLowerCase() : "none";
  const username = authContext && authContext.user && authContext.user.username
    ? String(authContext.user.username).trim().toLowerCase()
    : "";

  return `${role}:${username}`;
}

function collectMarkerNames(fileNamesInput) {
  const names = Array.isArray(fileNamesInput) ? fileNamesInput : [];
  const output = [];

  for (const rawName of names) {
    const candidate = String(rawName || "").trim().toLowerCase();
    if (!candidate || candidate === ".lock") {
      continue;
    }
    if (!FLAG_MARKER_NAME_PATTERN.test(candidate)) {
      continue;
    }
    if (!output.includes(candidate)) {
      output.push(candidate);
    }
  }

  return output;
}

function toPublicFlag(flag) {
  return {
    name: flag.name,
    message: flag.message,
    colorClass: flag.colorClass,
    backgroundColor: flag.backgroundColor || "",
    iconClass: flag.iconClass || "",
    restrictionType: flag.restrictionType
  };
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
  KBService
};

