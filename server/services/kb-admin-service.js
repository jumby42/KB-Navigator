const fs = require("fs/promises");
const path = require("path");
const {
  normalizeKbRelativePath,
  resolveKbPath,
  validateFolderName
} = require("../utils/path-utils");

const ADMIN_TREE_BUILD_CONCURRENCY = 12;
const INTEGRITY_SCAN_CONCURRENCY = 12;
const IMG_SRC_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(?:"([^\"]+)"|'([^']+)'|([^\s>]+))/gi;
const INTEGRITY_HISTORY_FILE = "integrity-history.json";
const INTEGRITY_HISTORY_MAX_ROWS = 5000;

class KBAdminService {
  constructor(config, logger, sanitizeService, draftService, flagService, versionService) {
    this.config = config;
    this.logger = logger;
    this.sanitizeService = sanitizeService;
    this.draftService = draftService;
    this.flagService = flagService;
    this.versionService = versionService;
    this.kbRoot = config.paths.kbRootAbsolute;
    this.treeCache = null;
    this.treeCacheDirty = true;
    this.treeCacheBuiltAt = null;
    this.treeCacheRebuildPromise = null;
    this.treeCacheVersion = 0;
    this.treeCacheSerialized = null;
    this.treeCacheSerializedVersion = -1;
    this.integrityCache = null;
    this.integrityCacheDirty = true;
    this.integrityScanPromise = null;
    this.integrityCacheVersion = 0;
    this.integrityHistoryPath = path.join(config.paths.dataDirAbsolute, INTEGRITY_HISTORY_FILE);
    this.integrityHistoryRows = [];
    this.integrityHistoryLoaded = false;
  }

  async getKnowledgebaseTree() {
    if (this.treeCache && !this.treeCacheDirty) {
      return this.treeCache;
    }

    if (this.treeCacheRebuildPromise) {
      await this.treeCacheRebuildPromise;
      return this.treeCache || {
        label: "Knowledgebase",
        path: "",
        children: []
      };
    }

    const startVersion = this.treeCacheVersion;
    this.treeCacheRebuildPromise = this.#rebuildTreeCacheUnlocked("read", startVersion)
      .finally(() => {
        this.treeCacheRebuildPromise = null;
      });

    await this.treeCacheRebuildPromise;
    return this.treeCache || {
      label: "Knowledgebase",
      path: "",
      children: []
    };
  }

  async getKnowledgebaseTreeSerialized() {
    const tree = await this.getKnowledgebaseTree();
    const version = this.treeCacheVersion;

    if (!this.treeCacheSerialized || this.treeCacheSerializedVersion !== version) {
      this.treeCacheSerialized = JSON.stringify(tree);
      this.treeCacheSerializedVersion = version;
    }

    return {
      ok: true,
      serialized: this.treeCacheSerialized,
      version,
      builtAt: this.treeCacheBuiltAt,
      dirty: this.treeCacheDirty
    };
  }

  markTreeCacheDirty(reason = "manual") {
    this.treeCacheDirty = true;
    this.treeCacheVersion += 1;
    this.treeCacheSerialized = null;
    this.treeCacheSerializedVersion = -1;
    this.integrityCacheDirty = true;
    this.integrityCacheVersion += 1;

    if (reason) {
      this.logger.info("Admin tree cache marked dirty", {
        event: "kb_admin_tree_dirty",
        reason
      });
    }

    return {
      ok: true,
      dirty: this.treeCacheDirty,
      builtAt: this.treeCacheBuiltAt,
      version: this.treeCacheVersion
    };
  }

  getTreeCacheStatus() {
    return {
      ok: true,
      dirty: this.treeCacheDirty,
      rebuilding: Boolean(this.treeCacheRebuildPromise),
      builtAt: this.treeCacheBuiltAt,
      hasCache: Boolean(this.treeCache),
      version: this.treeCacheVersion
    };
  }

  async scanIntegrity(options = {}) {
    const force = Boolean(options && options.force);
    if (!force && this.integrityCache && !this.integrityCacheDirty) {
      return this.integrityCache;
    }

    if (this.integrityScanPromise) {
      await this.integrityScanPromise;
      return this.integrityCache || {
        ok: false,
        message: "Integrity scan is unavailable."
      };
    }

    const startVersion = this.integrityCacheVersion;
    this.integrityScanPromise = this.#scanIntegrityUnlocked(startVersion)
      .finally(() => {
        this.integrityScanPromise = null;
      });

    await this.integrityScanPromise;
    return this.integrityCache || {
      ok: false,
      message: "Integrity scan is unavailable."
    };
  }
  async clearIntegrityHistory() {
    if (this.integrityScanPromise) {
      await this.integrityScanPromise;
    }

    await this.#ensureIntegrityHistoryLoaded();
    const clearedCount = this.integrityHistoryRows.length;
    this.integrityHistoryRows = [];
    await this.#saveIntegrityHistory();

    if (this.integrityCache && typeof this.integrityCache === "object") {
      this.integrityCache = {
        ...this.integrityCache,
        generatedAt: "",
        summary: null,
        brokenImages: [],
        unreachableNodes: [],
        defaultQuestionNodes: [],
        noAnswerNodes: [],
        defaultSolutionNodes: [],
        mixedContentNodes: [],
        emptyQuestionNodes: [],
        emptySolutionNodes: [],
        caseCollisionNodes: [],
        issuesByPath: {},
        historyRows: []
      };
    }

    const clearedAt = new Date().toISOString();
    this.logger.info("Integrity history cleared", {
      event: "kb_integrity_history_cleared",
      clearedAt,
      clearedCount
    });

    return {
      ok: true,
      clearedAt,
      clearedCount,
      generatedAt: "",
      summary: null,
      historyRows: []
    };
  }

  async createTopic(topicName, questionText) {
    const nameResult = validateFolderName(topicName);
    if (!nameResult.ok) {
      return nameResult;
    }

    const absolutePath = path.join(this.kbRoot, topicName);
    const collision = await exists(absolutePath);
    if (collision) {
      return { ok: false, message: "Topic already exists." };
    }

    await fs.mkdir(absolutePath, { recursive: false });
    const normalizedQuestion = normalizeQuestion(questionText);
    await fs.writeFile(path.join(absolutePath, "question.txt"), normalizedQuestion, "utf8");

    this.logger.info("Topic created", {
      event: "kb_topic_create",
      path: topicName
    });

    const patched = this.#applyIncrementalTreeUpdate("topic-create", () => {
      const rootChildren = this.#getTreeChildrenForPath("");
      if (!rootChildren) {
        return false;
      }

      if (rootChildren.some((entry) => entry && entry.path === topicName)) {
        return true;
      }

      rootChildren.push({
        label: topicName,
        path: topicName,
        type: "node",
        isDefaultContent: isDefaultQuestionText(normalizedQuestion),
        questionText: normalizeQuestionTreeText(normalizedQuestion),
        children: []
      });
      this.#sortTreeChildren(rootChildren);
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("topic-create");
    }

    return { ok: true, path: topicName };
  }

  async createAnswer(parentPathInput, answerName, kind) {
    const parentPath = normalizeKbRelativePath(parentPathInput);
    if (!parentPath) {
      return { ok: false, message: "Parent path is required." };
    }

    const nameResult = validateFolderName(answerName);
    if (!nameResult.ok) {
      return nameResult;
    }

    if (!["question", "solution"].includes(kind)) {
      return { ok: false, message: "Invalid answer kind." };
    }

    const parentResolved = resolveKbPath(this.kbRoot, parentPath);
    const parentStats = await fs.stat(parentResolved.absolute).catch(() => null);
    if (!parentStats || !parentStats.isDirectory()) {
      return { ok: false, message: "Parent path not found." };
    }

    const parentHasQuestion = await exists(path.join(parentResolved.absolute, "question.txt"));
    const parentHasSolution = await exists(path.join(parentResolved.absolute, "solution.html"));
    if (!parentHasQuestion || parentHasSolution) {
      return { ok: false, message: "Answers can only be added under a question node." };
    }

    const childAbsolute = path.join(parentResolved.absolute, answerName);
    const childRelative = normalizeKbRelativePath(`${parentResolved.relative}/${answerName}`);
    if (await exists(childAbsolute)) {
      return { ok: false, message: "Answer folder already exists." };
    }

    await fs.mkdir(childAbsolute, { recursive: false });
    if (kind === "question") {
      await fs.writeFile(path.join(childAbsolute, "question.txt"), `${DEFAULT_QUESTION_TEXT}\n`, "utf8");
    } else {
      await fs.writeFile(path.join(childAbsolute, "solution.html"), "<p></p>\n", "utf8");
    }

    this.logger.info("Answer created", {
      event: "kb_answer_create",
      parentPath: parentResolved.relative,
      path: childRelative,
      kind
    });

    const patched = this.#applyIncrementalTreeUpdate("answer-create", () => {
      const parentNode = this.#findTreeNodeByPath(parentResolved.relative);
      if (!parentNode || parentNode.type !== "node") {
        return false;
      }

      if (!Array.isArray(parentNode.children)) {
        parentNode.children = [];
      }

      if (parentNode.children.some((entry) => entry && entry.path === childRelative)) {
        return true;
      }

      const childNode = kind === "solution"
        ? {
            label: answerName,
            path: childRelative,
            type: "terminal",
            isDefaultContent: true,
            flags: [],
            children: []
          }
        : {
            label: answerName,
            path: childRelative,
            type: "node",
            isDefaultContent: true,
            questionText: normalizeQuestionTreeText(DEFAULT_QUESTION_TEXT),
            children: []
          };

      parentNode.children.push(childNode);
      this.#sortTreeChildren(parentNode.children);
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("answer-create");
    }

    return { ok: true, path: childRelative };
  }

  async getQuestion(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const questionPath = path.join(resolved.absolute, "question.txt");
    const raw = await fs.readFile(questionPath, "utf8").catch(() => null);
    if (raw === null) {
      return { ok: false, message: "Question not found." };
    }

    return {
      ok: true,
      path: resolved.relative,
      question: raw,
      isDefaultContent: isDefaultQuestionText(raw)
    };
  }

  async saveQuestion(pathInput, questionText, actorInput = "") {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const folderStats = await fs.stat(resolved.absolute).catch(() => null);
    if (!folderStats || !folderStats.isDirectory()) {
      return { ok: false, message: "Path not found." };
    }

    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (hasSolution) {
      return { ok: false, message: "Cannot save question on terminal solution node." };
    }

    const questionPath = path.join(resolved.absolute, "question.txt");
    const existingQuestion = await fs.readFile(questionPath, "utf8").catch(() => null);
    if (existingQuestion !== null) {
      await this.#recordVersionSnapshot({
        kbPath: resolved.relative,
        nodeType: "question",
        content: existingQuestion,
        actor: actorInput,
        reason: "before-save-question"
      });
    }

    const normalizedQuestion = normalizeQuestion(questionText);
    await fs.writeFile(questionPath, normalizedQuestion, "utf8");

    this.logger.info("Question saved", {
      event: "kb_question_save",
      path: resolved.relative
    });

    const patched = this.#applyIncrementalTreeUpdate("question-save", () => {
      const node = this.#findTreeNodeByPath(resolved.relative);
      if (!node) {
        return false;
      }

      node.type = "node";
      node.isDefaultContent = isDefaultQuestionText(normalizedQuestion);
      node.questionText = normalizeQuestionTreeText(normalizedQuestion);
      if (!Array.isArray(node.children)) {
        node.children = [];
      }
      if (node.flags) {
        delete node.flags;
      }

      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("question-save");
    }

    return { ok: true };
  }

  async getSolutionPreview(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const solutionPath = path.join(resolved.absolute, "solution.html");
    const raw = await fs.readFile(solutionPath, "utf8").catch(() => null);
    if (raw === null) {
      return { ok: false, message: "Solution not found." };
    }

    const availableFlags = await this.flagService.listDefinitions();
    const appliedFlags = await this.flagService.listAppliedFlags(resolved.absolute, availableFlags);

    return {
      ok: true,
      path: resolved.relative,
      solutionHtml: this.sanitizeService.sanitizeSolutionHtml(raw),
      isDefaultContent: isDefaultSolutionHtml(raw),
      flagNames: appliedFlags.map((flag) => flag.name),
      flags: appliedFlags.map(toAdminFlag),
      availableFlags: availableFlags.map(toAdminFlag)
    };
  }

  async getSolutionForEdit(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const solutionPath = path.join(resolved.absolute, "solution.html");
    const raw = await fs.readFile(solutionPath, "utf8").catch(() => null);
    if (raw === null) {
      return { ok: false, message: "Solution not found." };
    }

    const draft = await this.draftService.getDraft(resolved.relative);
    return {
      ok: true,
      path: resolved.relative,
      content: raw,
      publishedContent: raw,
      draftContent: draft ? String(draft.content || "") : null,
      draftExists: Boolean(draft),
      draft: draft
        ? {
            owner: draft.owner,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt
          }
        : null
    };
  }

  async getSolutionDraft(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const solutionPath = path.join(resolved.absolute, "solution.html");
    const hasSolution = await exists(solutionPath);
    if (!hasSolution) {
      return { ok: false, message: "Solution not found." };
    }

    const draft = await this.draftService.getDraft(resolved.relative);
    return {
      ok: true,
      path: resolved.relative,
      draftExists: Boolean(draft),
      draft: draft
        ? {
            owner: draft.owner,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt
          }
        : null
    };
  }

  async saveSolutionDraft(pathInput, owner, content) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (!hasSolution) {
      return { ok: false, message: "Solution not found." };
    }

    return this.draftService.saveDraft({
      pathInput: resolved.relative,
      owner,
      content
    });
  }

  async discardSolutionDraft(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    return this.draftService.deleteDraft(resolved.relative);
  }

  async publishSolution(pathInput, content, actorInput = "") {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const solutionPath = path.join(resolved.absolute, "solution.html");
    const hasSolution = await exists(solutionPath);
    if (!hasSolution) {
      return { ok: false, message: "Solution not found." };
    }

    const existingSolution = await fs.readFile(solutionPath, "utf8").catch(() => null);
    if (existingSolution !== null) {
      await this.#recordVersionSnapshot({
        kbPath: resolved.relative,
        nodeType: "solution",
        content: existingSolution,
        actor: actorInput,
        reason: "before-publish-solution"
      });
    }

    const sanitized = this.sanitizeService.sanitizeSolutionHtml(content);
    const persistedSolution = `${sanitized}\n`;
    await fs.writeFile(solutionPath, persistedSolution, "utf8");
    await this.draftService.deleteDraft(resolved.relative);

    this.logger.info("Solution published", {
      event: "kb_solution_publish",
      path: resolved.relative
    });

    const patched = this.#applyIncrementalTreeUpdate("solution-publish", () => {
      const node = this.#findTreeNodeByPath(resolved.relative);
      if (!node) {
        return false;
      }

      node.type = "terminal";
      node.isDefaultContent = isDefaultSolutionHtml(persistedSolution);
      if (node.questionText) {
        delete node.questionText;
      }
      if (!Array.isArray(node.children)) {
        node.children = [];
      }
      if (!Array.isArray(node.flags)) {
        node.flags = [];
      }

      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("solution-publish");
    }

    return { ok: true, path: resolved.relative };
  }

  async updateSolutionFlags(pathInput, flagNamesInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (!hasSolution) {
      return { ok: false, message: "Solution not found." };
    }

    const normalizedFlags = await this.flagService.normalizeSelectedFlagNames(flagNamesInput || []);
    if (!normalizedFlags.ok) {
      return normalizedFlags;
    }

    const selectedNames = normalizedFlags.flagNames;
    await this.flagService.clearKnownAssignmentsInFolder(resolved.absolute);

    for (const flagName of selectedNames) {
      await setMarker(path.join(resolved.absolute, flagName), true);
    }

    this.logger.info("Solution flags updated", {
      event: "kb_solution_flags",
      path: resolved.relative,
      flagNames: selectedNames
    });

    const availableFlags = await this.flagService.listDefinitions();
    const mapByName = new Map(availableFlags.map((entry) => [entry.name, entry]));

    const patched = this.#applyIncrementalTreeUpdate("solution-flags", () => {
      const node = this.#findTreeNodeByPath(resolved.relative);
      if (!node || node.type !== "terminal") {
        return false;
      }

      node.flags = selectedNames
        .map((name) => mapByName.get(name))
        .filter(Boolean)
        .map(toAdminFlag);
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("solution-flags");
    }

    return {
      ok: true,
      flagNames: selectedNames
    };
  }

  async getVersionHistory(pathInput) {
    const target = await this.#resolveVersionTarget(pathInput);
    if (!target.ok) {
      return target;
    }

    if (!this.versionService) {
      return { ok: true, path: target.path, nodeType: target.nodeType, versions: [] };
    }

    const versions = await this.versionService.listSnapshots(target.path, target.nodeType);
    return {
      ok: true,
      path: target.path,
      nodeType: target.nodeType,
      versions
    };
  }

  async rollbackVersion(pathInput, versionIdInput, actorInput = "") {
    const versionId = String(versionIdInput || "").trim();
    if (!versionId) {
      return { ok: false, message: "versionId is required." };
    }

    const target = await this.#resolveVersionTarget(pathInput);
    if (!target.ok) {
      return target;
    }

    if (!this.versionService) {
      return { ok: false, message: "Version history is not available." };
    }

    const snapshot = await this.versionService.getSnapshot(target.path, target.nodeType, versionId);
    if (!snapshot) {
      return { ok: false, message: "Version not found." };
    }

    const currentContent = await fs.readFile(target.filePath, "utf8").catch(() => null);
    if (currentContent === null) {
      return { ok: false, message: "Current content is unavailable." };
    }

    await fs.writeFile(target.filePath, String(snapshot.content || ""), "utf8");

    this.logger.info("Version rollback applied", {
      event: "kb_version_rollback",
      path: target.path,
      nodeType: target.nodeType,
      versionId,
      actor: normalizeActor(actorInput)
    });

    const patched = this.#applyIncrementalTreeUpdate("version-rollback", () => {
      const node = this.#findTreeNodeByPath(target.path);
      if (!node) {
        return false;
      }

      if (target.nodeType === "solution") {
        node.type = "terminal";
        node.isDefaultContent = isDefaultSolutionHtml(String(snapshot.content || ""));
        if (node.questionText) {
          delete node.questionText;
        }
        if (!Array.isArray(node.flags)) {
          node.flags = [];
        }
      } else {
        node.type = "node";
        node.isDefaultContent = isDefaultQuestionText(String(snapshot.content || ""));
        node.questionText = normalizeQuestionTreeText(String(snapshot.content || ""));
        if (!Array.isArray(node.children)) {
          node.children = [];
        }
      }

      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("version-rollback");
    }

    return {
      ok: true,
      path: target.path,
      nodeType: target.nodeType,
      versionId
    };
  }

  async deleteVersion(pathInput, versionIdInput, actorInput = "") {
    const versionId = String(versionIdInput || "").trim();
    if (!versionId) {
      return { ok: false, message: "versionId is required." };
    }

    const target = await this.#resolveVersionTarget(pathInput);
    if (!target.ok) {
      return target;
    }

    if (!this.versionService) {
      return { ok: false, message: "Version history is not available." };
    }

    const deleted = await this.versionService.deleteSnapshot(target.path, target.nodeType, versionId);
    if (!deleted.ok) {
      return deleted;
    }

    this.logger.info("Version deleted", {
      event: "kb_version_delete",
      path: target.path,
      nodeType: target.nodeType,
      versionId,
      actor: normalizeActor(actorInput)
    });

    return {
      ok: true,
      path: target.path,
      nodeType: target.nodeType,
      versionId
    };
  }

  async convertSolutionToNode(pathInput, questionText, actorInput = "") {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const solutionPath = path.join(resolved.absolute, "solution.html");
    const hasSolution = await exists(solutionPath);
    if (!hasSolution) {
      return { ok: false, message: "Solution not found." };
    }

    const archivedBase = "_archived_solution";
    let archivedName = `${archivedBase}.html`;
    let archivedPath = path.join(resolved.absolute, archivedName);
    if (await exists(archivedPath)) {
      archivedName = `${archivedBase}_${Date.now()}.html`;
      archivedPath = path.join(resolved.absolute, archivedName);
    }

    const currentSolution = await fs.readFile(solutionPath, "utf8").catch(() => null);
    if (currentSolution !== null) {
      await this.#recordVersionSnapshot({
        kbPath: resolved.relative,
        nodeType: "solution",
        content: currentSolution,
        actor: actorInput,
        reason: "before-convert-solution-to-node"
      });
    }

    await fs.rename(solutionPath, archivedPath);
    await this.flagService.clearKnownAssignmentsInFolder(resolved.absolute);

    const questionPath = path.join(resolved.absolute, "question.txt");
    const existingQuestion = await fs.readFile(questionPath, "utf8").catch(() => null);
    if (existingQuestion !== null) {
      await this.#recordVersionSnapshot({
        kbPath: resolved.relative,
        nodeType: "question",
        content: existingQuestion,
        actor: actorInput,
        reason: "before-save-question"
      });
    }

    const normalizedQuestion = normalizeQuestion(questionText);
    await fs.writeFile(questionPath, normalizedQuestion, "utf8");

    this.logger.info("Converted solution to node", {
      event: "kb_convert_solution_to_node",
      path: resolved.relative,
      archivedName
    });

    const patched = this.#applyIncrementalTreeUpdate("convert-solution-to-node", () => {
      const node = this.#findTreeNodeByPath(resolved.relative);
      if (!node) {
        return false;
      }

      node.type = "node";
      node.isDefaultContent = isDefaultQuestionText(normalizedQuestion);
      node.questionText = normalizeQuestionTreeText(normalizedQuestion);
      if (!Array.isArray(node.children)) {
        node.children = [];
      }
      if (node.flags) {
        delete node.flags;
      }
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("convert-solution-to-node");
    }

    return { ok: true, path: resolved.relative, archivedName };
  }

  async convertNodeToSolution(pathInput, confirmDestructive, actorInput = "") {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const questionPath = path.join(resolved.absolute, "question.txt");
    const hasQuestion = await exists(questionPath);
    if (!hasQuestion) {
      return { ok: false, message: "Question node not found." };
    }

    const childFolders = await listChildFolders(resolved.absolute);
    if (childFolders.length > 0 && !confirmDestructive) {
      return {
        ok: false,
        requiresConfirm: true,
        message: "Converting this node will delete child answer folders recursively."
      };
    }

    for (const child of childFolders) {
      await fs.rm(path.join(resolved.absolute, child), { recursive: true, force: true });
    }

    const currentQuestion = await fs.readFile(questionPath, "utf8").catch(() => null);
    if (currentQuestion !== null) {
      await this.#recordVersionSnapshot({
        kbPath: resolved.relative,
        nodeType: "question",
        content: currentQuestion,
        actor: actorInput,
        reason: "before-convert-node-to-solution"
      });
    }

    await fs.unlink(questionPath).catch(() => {});
    await fs.writeFile(path.join(resolved.absolute, "solution.html"), "<p></p>\n", "utf8");

    this.logger.info("Converted node to solution", {
      event: "kb_convert_node_to_solution",
      path: resolved.relative,
      deletedChildren: childFolders.length
    });

    const patched = this.#applyIncrementalTreeUpdate("convert-node-to-solution", () => {
      const node = this.#findTreeNodeByPath(resolved.relative);
      if (!node) {
        return false;
      }

      node.type = "terminal";
      node.isDefaultContent = true;
      if (node.questionText) {
        delete node.questionText;
      }
      node.children = [];
      node.flags = [];
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("convert-node-to-solution");
    }

    return { ok: true, path: resolved.relative };
  }


  async moveQuestionNode(sourcePathInput, destinationParentPathInput) {
    const sourcePath = normalizeKbRelativePath(sourcePathInput);
    const destinationParentPath = normalizeKbRelativePath(destinationParentPathInput);

    if (!sourcePath || sourcePath.startsWith("_trash")) {
      return { ok: false, message: "Source path is required." };
    }

    if (!destinationParentPath || destinationParentPath.startsWith("_trash")) {
      return { ok: false, message: "Destination parent path is required." };
    }

    if (sourcePath === destinationParentPath || destinationParentPath.startsWith(`${sourcePath}/`)) {
      return { ok: false, message: "Cannot move a node into itself or its descendant." };
    }

    const sourceResolved = resolveKbPath(this.kbRoot, sourcePath);
    const destinationParentResolved = resolveKbPath(this.kbRoot, destinationParentPath);

    const sourceStats = await fs.stat(sourceResolved.absolute).catch(() => null);
    if (!sourceStats || !sourceStats.isDirectory()) {
      return { ok: false, message: "Source path not found." };
    }

    const destinationParentStats = await fs.stat(destinationParentResolved.absolute).catch(() => null);
    if (!destinationParentStats || !destinationParentStats.isDirectory()) {
      return { ok: false, message: "Destination parent path not found." };
    }

    const [sourceHasQuestion, sourceHasSolution] = await Promise.all([
      exists(path.join(sourceResolved.absolute, "question.txt")),
      exists(path.join(sourceResolved.absolute, "solution.html"))
    ]);
    if (!sourceHasQuestion || sourceHasSolution) {
      return { ok: false, message: "Source must be a question node." };
    }

    const [destinationHasQuestion, destinationHasSolution] = await Promise.all([
      exists(path.join(destinationParentResolved.absolute, "question.txt")),
      exists(path.join(destinationParentResolved.absolute, "solution.html"))
    ]);
    if (!destinationHasQuestion || destinationHasSolution) {
      return { ok: false, message: "Destination must be a question node." };
    }

    const sourceName = path.basename(sourceResolved.relative);
    const destinationRelative = normalizeKbRelativePath(`${destinationParentResolved.relative}/${sourceName}`);
    if (!destinationRelative) {
      return { ok: false, message: "Unable to compute destination path." };
    }

    if (destinationRelative === sourceResolved.relative) {
      return { ok: false, message: "Source and destination are the same." };
    }

    if (destinationRelative.startsWith(`${sourceResolved.relative}/`)) {
      return { ok: false, message: "Cannot move a node into itself or its descendant." };
    }

    const destinationAbsolute = resolveKbPath(this.kbRoot, destinationRelative).absolute;
    const collision = await exists(destinationAbsolute);
    if (collision) {
      return { ok: false, message: "Move collision: destination already exists." };
    }

    await fs.rename(sourceResolved.absolute, destinationAbsolute);

    this.logger.info("Question node moved", {
      event: "kb_move_question",
      oldPath: sourceResolved.relative,
      newPath: destinationRelative
    });

    const patched = this.#applyIncrementalTreeUpdate("path-move-question", () => {
      const found = this.#findTreeNodeWithParent(sourceResolved.relative);
      if (!found || !Array.isArray(found.parentChildren) || found.index < 0) {
        return false;
      }

      const destinationParentChildren = this.#getTreeChildrenForPath(destinationParentResolved.relative);
      if (!destinationParentChildren) {
        return false;
      }

      const movingNode = found.node;
      const oldPrefix = movingNode.path;

      found.parentChildren.splice(found.index, 1);
      this.#rewriteTreeNodePath(movingNode, oldPrefix, destinationRelative);
      destinationParentChildren.push(movingNode);

      this.#sortTreeChildren(found.parentChildren);
      this.#sortTreeChildren(destinationParentChildren);
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("path-move-question");
    }

    return {
      ok: true,
      oldPath: sourceResolved.relative,
      path: destinationRelative
    };
  }  async renamePath(pathInput, newNameInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath || normalizedPath.startsWith("_trash")) {
      return { ok: false, message: "Invalid path for rename." };
    }

    const nameResult = validateFolderName(newNameInput);
    if (!nameResult.ok) {
      return nameResult;
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const parentAbsolute = path.dirname(resolved.absolute);
    const destinationAbsolute = path.join(parentAbsolute, newNameInput);
    const destinationRelative = normalizeKbRelativePath(path.relative(this.kbRoot, destinationAbsolute));

    const sourceStats = await fs.stat(resolved.absolute).catch(() => null);
    if (!sourceStats || !sourceStats.isDirectory()) {
      return { ok: false, message: "Path not found." };
    }

    const collision = await exists(destinationAbsolute);
    if (collision) {
      return { ok: false, message: "Rename collision: destination already exists." };
    }

    await fs.rename(resolved.absolute, destinationAbsolute);

    this.logger.info("Path renamed", {
      event: "kb_rename",
      oldPath: resolved.relative,
      newPath: destinationRelative
    });

    const patched = this.#applyIncrementalTreeUpdate("path-rename", () => {
      const found = this.#findTreeNodeWithParent(resolved.relative);
      if (!found || !Array.isArray(found.parentChildren) || found.index < 0) {
        return false;
      }

      const destinationParentPath = destinationRelative.includes("/")
        ? destinationRelative.slice(0, destinationRelative.lastIndexOf("/"))
        : "";
      const destinationParentChildren = this.#getTreeChildrenForPath(destinationParentPath);
      if (!destinationParentChildren) {
        return false;
      }

      const movingNode = found.node;
      const oldPrefix = movingNode.path;

      found.parentChildren.splice(found.index, 1);
      movingNode.label = newNameInput;
      this.#rewriteTreeNodePath(movingNode, oldPrefix, destinationRelative);
      destinationParentChildren.push(movingNode);

      this.#sortTreeChildren(found.parentChildren);
      this.#sortTreeChildren(destinationParentChildren);
      return true;
    });

    if (!patched) {
      this.markTreeCacheDirty("path-rename");
    }

    return { ok: true, path: destinationRelative };
  }

  async listSolutionImages(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (!hasSolution) {
      return { ok: false, message: "Solution folder not found." };
    }

    const entries = await fs.readdir(resolved.absolute, { withFileTypes: true }).catch(() => []);
    const images = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => this.config.uploads.allowedImageExtensions.includes(
        path.extname(entry.name).toLowerCase().replace(".", "")
      ))
      .map((entry) => {
        const filename = String(entry.name || "").trim();
        const relativePath = normalizeKbRelativePath(`${resolved.relative}/${filename}`);
        return {
          filename,
          relativePath
        };
      })
      .filter((entry) => entry.filename && entry.relativePath)
      .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" }));

    return {
      ok: true,
      path: resolved.relative,
      images
    };
  }

  async deleteSolutionImage(pathInput, filenameInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const rawFilename = String(filenameInput || "").trim();
    if (!rawFilename) {
      return { ok: false, message: "Image filename is required." };
    }

    const filename = path.basename(rawFilename);
    if (filename !== rawFilename || filename.includes("/") || filename.includes("\\")) {
      return { ok: false, message: "Invalid image filename." };
    }

    const extension = path.extname(filename).toLowerCase().replace(".", "");
    if (!this.config.uploads.allowedImageExtensions.includes(extension)) {
      return { ok: false, message: "Only image files can be deleted." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (!hasSolution) {
      return { ok: false, message: "Solution folder not found." };
    }

    const targetAbsolute = path.join(resolved.absolute, filename);
    let stat;
    try {
      stat = await fs.stat(targetAbsolute);
    } catch {
      return { ok: false, message: "Image file not found." };
    }

    if (!stat.isFile()) {
      return { ok: false, message: "Image file not found." };
    }

    await fs.unlink(targetAbsolute);
    this.integrityCacheDirty = true;
    this.integrityCacheVersion += 1;

    const relativePath = normalizeKbRelativePath(`${resolved.relative}/${filename}`);
    this.logger.info("Solution image deleted", {
      event: "kb_image_delete",
      path: resolved.relative,
      filename
    });

    return {
      ok: true,
      path: resolved.relative,
      filename,
      relativePath
    };
  }
  async saveUploadedImage(pathInput, file) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const hasSolution = await exists(path.join(resolved.absolute, "solution.html"));
    if (!hasSolution) {
      return { ok: false, message: "Images can only be uploaded to solution folders." };
    }

    if (!file || !file.buffer || !file.originalname) {
      return { ok: false, message: "Image file is required." };
    }

    const extension = path.extname(file.originalname).toLowerCase().replace(".", "");
    if (!this.config.uploads.allowedImageExtensions.includes(extension)) {
      return { ok: false, message: "Unsupported image type." };
    }

    const targetName = uniqueUploadName(file.originalname);
    const targetAbsolute = path.join(resolved.absolute, targetName);
    await fs.writeFile(targetAbsolute, file.buffer);

    this.logger.info("Image uploaded", {
      event: "kb_image_upload",
      path: resolved.relative,
      filename: targetName
    });

    return {
      ok: true,
      filename: targetName,
      relativePath: `${resolved.relative}/${targetName}`
    };
  }

  async #rebuildTreeCacheUnlocked(reason = "manual", startVersion = this.treeCacheVersion) {
    const definitions = await this.flagService.listDefinitions();
    const children = await this.#buildTree(this.kbRoot, "", definitions);

    const tree = {
      label: "Knowledgebase",
      path: "",
      children
    };

    this.treeCache = tree;
    this.treeCacheBuiltAt = new Date().toISOString();
    this.treeCacheSerialized = null;
    this.treeCacheSerializedVersion = -1;

    const staleDuringBuild = this.treeCacheVersion !== startVersion;
    this.treeCacheDirty = staleDuringBuild;

    this.logger.info("Admin tree cache rebuilt", {
      event: "kb_admin_tree_rebuild",
      reason,
      builtAt: this.treeCacheBuiltAt,
      staleDuringBuild,
      startVersion,
      currentVersion: this.treeCacheVersion
    });

    return tree;
  }

  #applyIncrementalTreeUpdate(reason, mutator) {
    if (!this.treeCache || this.treeCacheDirty || this.treeCacheRebuildPromise) {
      return false;
    }

    const patchFn = typeof mutator === "function" ? mutator : () => false;
    let patched = false;
    try {
      patched = Boolean(patchFn(this.treeCache));
    } catch (error) {
      this.logger.warn("Admin tree cache incremental patch failed", {
        event: "kb_admin_tree_patch_error",
        reason,
        error: error.message
      });
      return false;
    }

    if (!patched) {
      return false;
    }

    this.treeCacheBuiltAt = new Date().toISOString();
    this.treeCacheVersion += 1;
    this.treeCacheSerialized = null;
    this.treeCacheSerializedVersion = -1;
    this.integrityCacheDirty = true;
    this.integrityCacheVersion += 1;

    this.logger.info("Admin tree cache patched", {
      event: "kb_admin_tree_patch",
      reason,
      builtAt: this.treeCacheBuiltAt,
      version: this.treeCacheVersion
    });

    return true;
  }

  async #scanIntegrityUnlocked(startVersion = this.integrityCacheVersion) {
    await this.#ensureIntegrityHistoryLoaded();

    const summary = {
      scannedNodes: 0,
      questionNodes: 0,
      solutionNodes: 0,
      brokenImageRefs: 0,
      solutionsWithBrokenImages: 0,
      unreachableNodes: 0,
      defaultQuestionTextNodes: 0,
      questionNodesWithoutAnswers: 0,
      defaultSolutionContentNodes: 0,
      mixedContentNodes: 0,
      emptyQuestionNodes: 0,
      emptySolutionNodes: 0,
      caseCollisionNodes: 0
    };
    const brokenImages = [];
    const unreachableNodes = [];
    const defaultQuestionNodes = [];
    const noAnswerNodes = [];
    const defaultSolutionNodes = [];
    const mixedContentNodes = [];
    const emptyQuestionNodes = [];
    const emptySolutionNodes = [];
    const caseCollisionNodes = [];
    const issuesByPath = {};
    const affectedSolutionPaths = new Set();

    await this.#scanIntegrityDirectory(this.kbRoot, "", {
      parentNodeType: "root",
      ancestorBlockedReason: "",
      summary,
      brokenImages,
      unreachableNodes,
      defaultQuestionNodes,
      noAnswerNodes,
      defaultSolutionNodes,
      mixedContentNodes,
      emptyQuestionNodes,
      emptySolutionNodes,
      caseCollisionNodes,
      issuesByPath,
      affectedSolutionPaths
    });

    const generatedAt = new Date().toISOString();
    const staleDuringBuild = this.integrityCacheVersion !== startVersion;
    this.integrityCacheDirty = staleDuringBuild;
    const result = {
      ok: true,
      generatedAt,
      summary,
      brokenImages,
      unreachableNodes,
      defaultQuestionNodes,
      noAnswerNodes,
      defaultSolutionNodes,
      mixedContentNodes,
      emptyQuestionNodes,
      emptySolutionNodes,
      caseCollisionNodes,
      issuesByPath
    };

    const historyRows = this.#mergeIntegrityHistoryRows(result, generatedAt);
    this.integrityHistoryRows = historyRows;
    try {
      await this.#saveIntegrityHistory();
    } catch (error) {
      this.logger.warn("Failed to persist integrity history", {
        event: "kb_integrity_history_persist_failed",
        error: error.message
      });
    }
    result.historyRows = this.integrityHistoryRows.slice();

    this.integrityCache = result;

    this.logger.info("Integrity scan completed", {
      event: "kb_integrity_scan_complete",
      generatedAt,
      staleDuringBuild,
      startVersion,
      currentVersion: this.integrityCacheVersion,
      scannedNodes: summary.scannedNodes,
      brokenImageRefs: summary.brokenImageRefs,
      unreachableNodes: summary.unreachableNodes,
      defaultQuestionTextNodes: summary.defaultQuestionTextNodes,
      questionNodesWithoutAnswers: summary.questionNodesWithoutAnswers,
      defaultSolutionContentNodes: summary.defaultSolutionContentNodes,
      mixedContentNodes: summary.mixedContentNodes,
      emptyQuestionNodes: summary.emptyQuestionNodes,
      emptySolutionNodes: summary.emptySolutionNodes,
      caseCollisionNodes: summary.caseCollisionNodes,
      historyRows: result.historyRows.length
    });
  }

  async #scanIntegrityDirectory(absoluteDir, relativeDir, context) {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
    const childDirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => !(absoluteDir === this.kbRoot && entry.name === "_trash"));
    const caseCollisionLookup = buildCaseCollisionLookup(childDirs);

    await mapWithConcurrency(
      childDirs,
      INTEGRITY_SCAN_CONCURRENCY,
      async (child) => {
        const childAbsolute = path.join(absoluteDir, child.name);
        const childRelative = normalizeKbRelativePath(`${relativeDir}/${child.name}`);
        const questionPath = path.join(childAbsolute, "question.txt");
        const solutionPath = path.join(childAbsolute, "solution.html");
        const [hasQuestion, hasSolution] = await Promise.all([
          exists(questionPath),
          exists(solutionPath)
        ]);
        const caseCollisionGroup = caseCollisionLookup.get(child.name) || [];

        context.summary.scannedNodes += 1;
        if (hasSolution) {
          context.summary.solutionNodes += 1;
        } else if (hasQuestion) {
          context.summary.questionNodes += 1;
        }

        if (caseCollisionGroup.length > 1) {
          const siblings = caseCollisionGroup.filter((name) => name !== child.name);
          context.summary.caseCollisionNodes += 1;
          context.caseCollisionNodes.push({
            path: childRelative,
            nodeType: hasSolution ? "terminal" : hasQuestion ? "node" : "missing",
            reason: `Sibling folder names differ only by case: ${caseCollisionGroup.join(", ")}.`,
            siblings
          });
          this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
            type: "case-collision",
            siblings
          });
        }

        if (hasQuestion && hasSolution) {
          context.summary.mixedContentNodes += 1;
          context.mixedContentNodes.push({
            path: childRelative,
            nodeType: "mixed",
            reason: "Folder has both question.txt and solution.html."
          });
          this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
            type: "mixed-content"
          });
        }

        const nodeType = hasSolution ? "terminal" : hasQuestion ? "node" : "missing";
        const blockedReason = resolveBlockedReason({
          parentNodeType: context.parentNodeType,
          ancestorBlockedReason: context.ancestorBlockedReason,
          nodeType
        });

        if (blockedReason) {
          context.summary.unreachableNodes += 1;
          context.unreachableNodes.push({
            path: childRelative,
            nodeType,
            parentPath: normalizeKbRelativePath(relativeDir),
            reason: blockedReason
          });
          this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
            type: "unreachable",
            reason: blockedReason
          });
        }

        let questionText = "";
        if (hasQuestion) {
          questionText = await fs.readFile(questionPath, "utf8").catch(() => "");
          if (!String(questionText || "").trim()) {
            context.summary.emptyQuestionNodes += 1;
            context.emptyQuestionNodes.push({
              path: childRelative,
              nodeType: "node",
              reason: "Question file is empty or whitespace only."
            });
            this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
              type: "empty-question"
            });
          }
        }

        if (nodeType === "node") {
          if (hasQuestion && isDefaultQuestionText(questionText)) {
            context.summary.defaultQuestionTextNodes += 1;
            context.defaultQuestionNodes.push({
              path: childRelative,
              nodeType: "node",
              reason: "Question text is unchanged from the default value."
            });
            this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
              type: "default-question"
            });
          }

          const nestedEntries = await fs.readdir(childAbsolute, { withFileTypes: true }).catch(() => []);
          const answerCount = nestedEntries
            .filter((entry) => entry.isDirectory())
            .filter((entry) => !entry.name.startsWith("."))
            .length;
          if (answerCount === 0) {
            context.summary.questionNodesWithoutAnswers += 1;
            context.noAnswerNodes.push({
              path: childRelative,
              nodeType: "node",
              reason: "Question node has no answer folders configured."
            });
            this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
              type: "no-answers"
            });
          }
        }

        if (hasSolution) {
          const solutionHtml = await fs.readFile(solutionPath, "utf8").catch(() => "");
          const strippedSolutionText = stripHtmlTextContent(solutionHtml);
          if (!strippedSolutionText) {
            context.summary.emptySolutionNodes += 1;
            context.emptySolutionNodes.push({
              path: childRelative,
              nodeType: "terminal",
              reason: "Solution body is empty after HTML content is removed."
            });
            this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
              type: "empty-solution"
            });
          }

          if (isDefaultSolutionHtml(solutionHtml)) {
            context.summary.defaultSolutionContentNodes += 1;
            context.defaultSolutionNodes.push({
              path: childRelative,
              nodeType: "terminal",
              reason: "Solution content is unchanged from the default value."
            });
            this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
              type: "default-solution"
            });
          }

          const brokenRefs = await this.#findBrokenImageReferences(childAbsolute, solutionHtml);
          if (brokenRefs.length) {
            context.summary.brokenImageRefs += brokenRefs.length;
            context.affectedSolutionPaths.add(childRelative);
            context.summary.solutionsWithBrokenImages = context.affectedSolutionPaths.size;

            for (const broken of brokenRefs) {
              context.brokenImages.push({
                path: childRelative,
                nodeType: "terminal",
                source: broken.source,
                reason: broken.reason
              });
              this.#trackIntegrityPathIssue(context.issuesByPath, childRelative, {
                type: "broken-image",
                source: broken.source
              });
            }
          }
        }

        await this.#scanIntegrityDirectory(childAbsolute, childRelative, {
          ...context,
          parentNodeType: nodeType,
          ancestorBlockedReason: blockedReason || context.ancestorBlockedReason
        });
      }
    );
  }

  #trackIntegrityPathIssue(issuesByPath, kbPathInput, issue) {
    const kbPath = normalizeKbRelativePath(kbPathInput);
    if (!kbPath) {
      return;
    }

    const existing = issuesByPath[kbPath] || {
      brokenImageCount: 0,
      brokenImageSources: [],
      unreachableReasons: [],
      defaultQuestion: false,
      noAnswers: false,
      defaultSolution: false,
      mixedContent: false,
      emptyQuestion: false,
      emptySolution: false,
      caseCollisionSiblings: []
    };

    if (issue.type === "broken-image") {
      existing.brokenImageCount += 1;
      if (issue.source && existing.brokenImageSources.length < 5) {
        existing.brokenImageSources.push(issue.source);
      }
    } else if (issue.type === "unreachable" && issue.reason) {
      if (!existing.unreachableReasons.includes(issue.reason)) {
        existing.unreachableReasons.push(issue.reason);
      }
    } else if (issue.type === "default-question") {
      existing.defaultQuestion = true;
    } else if (issue.type === "no-answers") {
      existing.noAnswers = true;
    } else if (issue.type === "default-solution") {
      existing.defaultSolution = true;
    } else if (issue.type === "mixed-content") {
      existing.mixedContent = true;
    } else if (issue.type === "empty-question") {
      existing.emptyQuestion = true;
    } else if (issue.type === "empty-solution") {
      existing.emptySolution = true;
    } else if (issue.type === "case-collision") {
      const siblings = Array.isArray(issue.siblings) ? issue.siblings : [];
      for (const sibling of siblings) {
        const value = String(sibling || "").trim();
        if (!value || existing.caseCollisionSiblings.includes(value)) {
          continue;
        }
        existing.caseCollisionSiblings.push(value);
      }
    }

    issuesByPath[kbPath] = existing;
  }

  async #findBrokenImageReferences(nodeAbsolutePath, html) {
    const sources = extractImageSources(html);
    if (!sources.length) {
      return [];
    }

    const broken = [];
    for (const source of sources) {
      if (!isLocalImageSource(source)) {
        continue;
      }

      const resolved = resolveLocalImageSource(this.kbRoot, nodeAbsolutePath, source);
      if (!resolved.ok) {
        broken.push({ source, reason: resolved.reason });
        continue;
      }

      const existsFile = await exists(resolved.absolutePath);
      if (!existsFile) {
        broken.push({ source, reason: "Referenced image file does not exist." });
      }
    }

    return broken;
  }
  #mergeIntegrityHistoryRows(result, foundAt) {
    const found = this.#normalizeFoundAt(foundAt);
    const existingRows = this.#normalizeIntegrityHistoryRows(this.integrityHistoryRows);
    const existingByPath = new Map(existingRows.map((entry) => [entry.path, entry]));
    const currentRows = this.#buildIntegrityHistoryRows(result);
    const merged = [];

    for (const row of currentRows) {
      const previous = existingByPath.get(row.path);
      const previousSignature = previous ? this.#integrityHistoryRowSignature(previous) : "";
      const nextSignature = this.#integrityHistoryRowSignature(row);
      merged.push({
        ...row,
        foundAt: previous && previousSignature === nextSignature
          ? this.#normalizeFoundAt(previous.foundAt)
          : found
      });
    }

    return this.#normalizeIntegrityHistoryRows(merged);
  }

  #buildIntegrityHistoryRows(result) {
    const issueMap = result && result.issuesByPath && typeof result.issuesByPath === "object"
      ? result.issuesByPath
      : {};
    const paths = Object.keys(issueMap).sort((a, b) => String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" }));
    const rows = [];

    for (const rawPath of paths) {
      const row = this.#buildIntegrityHistoryRow(rawPath, issueMap[rawPath]);
      if (row) {
        rows.push(row);
      }
    }

    return rows;
  }

  #buildIntegrityHistoryRow(pathInput, issueInput) {
    const kbPath = normalizeKbRelativePath(pathInput);
    if (!kbPath || !issueInput || typeof issueInput !== "object") {
      return null;
    }

    const issue = issueInput;
    const labels = [];
    const details = [];
    const missingImagePaths = [];

    const brokenImageCount = Number(issue.brokenImageCount || 0);
    if (brokenImageCount > 0) {
      labels.push("Broken image");
      const sources = Array.isArray(issue.brokenImageSources) ? issue.brokenImageSources : [];
      for (const source of sources) {
        const value = String(source || "").trim();
        if (value && !missingImagePaths.includes(value)) {
          missingImagePaths.push(value);
        }
      }
      details.push(`Broken image references: ${brokenImageCount}.`);
    }

    const unreachableReasons = Array.isArray(issue.unreachableReasons)
      ? issue.unreachableReasons.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    if (unreachableReasons.length) {
      labels.push("Unreachable node");
      details.push(`Unreachable reason${unreachableReasons.length === 1 ? "" : "s"}: ${unreachableReasons.join("; ")}`);
    }

    if (issue.defaultQuestion) {
      labels.push("Default question");
      details.push("Question text is unchanged from the default value.");
    }

    if (issue.noAnswers) {
      labels.push("No answers");
      details.push("Question node has no answer folders configured.");
    }

    if (issue.defaultSolution || issue.emptySolution) {
      labels.push("Solution is empty");
      details.push("Solution content is empty or unchanged from the default value.");
    }

    if (issue.mixedContent) {
      labels.push("Mixed node content");
      details.push("Folder has both question.txt and solution.html.");
    }

    if (issue.emptyQuestion) {
      labels.push("Empty question");
      details.push("Question file is empty or whitespace only.");
    }

    const caseCollisionSiblings = Array.isArray(issue.caseCollisionSiblings)
      ? issue.caseCollisionSiblings.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    if (caseCollisionSiblings.length) {
      labels.push("Case collision");
      details.push(`Sibling folder names differ only by case: ${caseCollisionSiblings.join(", ")}.`);
    }

    if (!labels.length) {
      return null;
    }

    const issueTitle = labels.length === 1
      ? labels[0]
      : labels.join(", ");

    return {
      path: kbPath,
      issue: issueTitle,
      detail: details.join(" | "),
      missingImagePath: missingImagePaths.join(" | ")
    };
  }

  #integrityHistoryRowSignature(entryInput) {
    const entry = entryInput && typeof entryInput === "object" ? entryInput : {};
    return JSON.stringify({
      issue: String(entry.issue || ""),
      detail: String(entry.detail || ""),
      missingImagePath: String(entry.missingImagePath || "")
    });
  }

  #normalizeFoundAt(valueInput) {
    const value = String(valueInput || "").trim();
    if (!value) {
      return new Date().toISOString();
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return new Date().toISOString();
    }
    return new Date(parsed).toISOString();
  }

  #normalizeIntegrityHistoryRows(rowsInput) {
    const rows = Array.isArray(rowsInput) ? rowsInput : [];
    const byPath = new Map();

    for (const entry of rows) {
      const kbPath = normalizeKbRelativePath(entry && entry.path ? entry.path : "");
      if (!kbPath) {
        continue;
      }

      const normalized = {
        path: kbPath,
        issue: String(entry && entry.issue ? entry.issue : ""),
        detail: String(entry && entry.detail ? entry.detail : ""),
        missingImagePath: String(entry && entry.missingImagePath ? entry.missingImagePath : ""),
        foundAt: this.#normalizeFoundAt(entry && entry.foundAt ? entry.foundAt : "")
      };

      const existing = byPath.get(kbPath);
      if (!existing) {
        byPath.set(kbPath, normalized);
        continue;
      }

      const existingTs = Date.parse(existing.foundAt);
      const candidateTs = Date.parse(normalized.foundAt);
      if (!Number.isNaN(candidateTs) && (Number.isNaN(existingTs) || candidateTs >= existingTs)) {
        byPath.set(kbPath, normalized);
      }
    }

    return Array.from(byPath.values())
      .sort((a, b) => String(a.path || "").localeCompare(String(b.path || ""), undefined, { sensitivity: "base" }))
      .slice(0, INTEGRITY_HISTORY_MAX_ROWS);
  }

  async #ensureIntegrityHistoryLoaded() {
    if (this.integrityHistoryLoaded) {
      return;
    }

    await fs.mkdir(path.dirname(this.integrityHistoryPath), { recursive: true });
    const raw = await fs.readFile(this.integrityHistoryPath, "utf8").catch((error) => {
      if (error && error.code === "ENOENT") {
        return "";
      }
      throw error;
    });

    if (!raw.trim()) {
      this.integrityHistoryRows = [];
      this.integrityHistoryLoaded = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
      this.integrityHistoryRows = this.#normalizeIntegrityHistoryRows(rows);
    } catch (error) {
      this.logger.warn("Integrity history file is invalid JSON; history reset in memory", {
        event: "kb_integrity_history_parse_failed",
        file: this.integrityHistoryPath,
        error: error.message
      });
      this.integrityHistoryRows = [];
    }

    this.integrityHistoryLoaded = true;
  }

  async #saveIntegrityHistory() {
    await fs.mkdir(path.dirname(this.integrityHistoryPath), { recursive: true });
    await writeJsonAtomic(this.integrityHistoryPath, {
      version: 1,
      rows: this.#normalizeIntegrityHistoryRows(this.integrityHistoryRows)
    });
  }

  #getTreeChildrenForPath(pathInput) {
    if (!this.treeCache || !Array.isArray(this.treeCache.children)) {
      return null;
    }

    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return this.treeCache.children;
    }

    const node = this.#findTreeNodeByPath(normalizedPath);
    if (!node) {
      return null;
    }

    if (!Array.isArray(node.children)) {
      node.children = [];
    }

    return node.children;
  }

  #findTreeNodeByPath(pathInput) {
    if (!this.treeCache || !Array.isArray(this.treeCache.children)) {
      return null;
    }

    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return null;
    }

    let currentChildren = this.treeCache.children;
    let currentNode = null;
    for (const segment of normalizedPath.split("/")) {
      currentNode = Array.isArray(currentChildren)
        ? currentChildren.find((entry) => entry && entry.label === segment)
        : null;
      if (!currentNode) {
        return null;
      }
      currentChildren = currentNode.children;
    }

    return currentNode;
  }

  #findTreeNodeWithParent(pathInput) {
    if (!this.treeCache || !Array.isArray(this.treeCache.children)) {
      return null;
    }

    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return null;
    }

    const segments = normalizedPath.split("/");
    let parentChildren = this.treeCache.children;
    let currentNode = null;

    for (const segment of segments) {
      const index = Array.isArray(parentChildren)
        ? parentChildren.findIndex((entry) => entry && entry.label === segment)
        : -1;
      if (index < 0) {
        return null;
      }

      currentNode = parentChildren[index];
      if (segment === segments[segments.length - 1]) {
        return { node: currentNode, parentChildren, index };
      }

      if (!Array.isArray(currentNode.children)) {
        return null;
      }
      parentChildren = currentNode.children;
    }

    return null;
  }

  #rewriteTreeNodePath(node, oldPrefix, newPrefix) {
    if (!node || !oldPrefix || !newPrefix) {
      return;
    }

    if (node.path === oldPrefix) {
      node.path = newPrefix;
    } else if (String(node.path || "").startsWith(`${oldPrefix}/`)) {
      node.path = `${newPrefix}${String(node.path).slice(oldPrefix.length)}`;
    }

    if (!Array.isArray(node.children)) {
      return;
    }

    for (const child of node.children) {
      this.#rewriteTreeNodePath(child, oldPrefix, newPrefix);
    }
  }

  #sortTreeChildren(childrenInput) {
    if (!Array.isArray(childrenInput)) {
      return;
    }

    childrenInput.sort((a, b) => String(a && a.label ? a.label : "").localeCompare(String(b && b.label ? b.label : ""), undefined, { sensitivity: "base" }));
  }

  async #resolveVersionTarget(pathInput) {
    const normalizedPath = normalizeKbRelativePath(pathInput);
    if (!normalizedPath) {
      return { ok: false, message: "Path is required." };
    }

    const resolved = resolveKbPath(this.kbRoot, normalizedPath);
    const folderStats = await fs.stat(resolved.absolute).catch(() => null);
    if (!folderStats || !folderStats.isDirectory()) {
      return { ok: false, message: "Path not found." };
    }

    const solutionPath = path.join(resolved.absolute, "solution.html");
    if (await exists(solutionPath)) {
      return {
        ok: true,
        path: resolved.relative,
        nodeType: "solution",
        filePath: solutionPath
      };
    }

    const questionPath = path.join(resolved.absolute, "question.txt");
    if (await exists(questionPath)) {
      return {
        ok: true,
        path: resolved.relative,
        nodeType: "question",
        filePath: questionPath
      };
    }

    return { ok: false, message: "Question or solution content not found." };
  }

  async #recordVersionSnapshot({ kbPath, nodeType, content, actor, reason }) {
    if (!this.versionService) {
      return;
    }

    try {
      const result = await this.versionService.recordSnapshot({
        kbPathInput: kbPath,
        nodeTypeInput: nodeType,
        contentInput: content,
        actorInput: actor,
        reasonInput: reason
      });

      if (!result.ok) {
        this.logger.warn("Version snapshot skipped", {
          event: "kb_version_snapshot_skip",
          path: kbPath,
          nodeType,
          reason,
          message: result.message || "Snapshot rejected"
        });
      }
    } catch (error) {
      this.logger.warn("Version snapshot failed", {
        event: "kb_version_snapshot_error",
        path: kbPath,
        nodeType,
        reason,
        error: error.message
      });
    }
  }

  async #buildTree(absoluteDir, relativeDir, definitions) {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
    const childDirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => !(absoluteDir === this.kbRoot && entry.name === "_trash"))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const output = await mapWithConcurrency(
      childDirs,
      ADMIN_TREE_BUILD_CONCURRENCY,
      async (child) => {
        const childAbsolute = path.join(absoluteDir, child.name);
        const childRelative = normalizeKbRelativePath(`${relativeDir}/${child.name}`);
        const hasSolution = await exists(path.join(childAbsolute, "solution.html"));

        const node = {
          label: child.name,
          path: childRelative,
          type: hasSolution ? "terminal" : "node"
        };

        if (hasSolution) {
          const [appliedFlags, solutionRaw] = await Promise.all([
            this.flagService.listAppliedFlags(childAbsolute, definitions),
            fs.readFile(path.join(childAbsolute, "solution.html"), "utf8").catch(() => "")
          ]);
          node.flags = appliedFlags.map(toAdminFlag);
          node.isDefaultContent = isDefaultSolutionHtml(solutionRaw);
        } else {
          const questionRaw = await fs.readFile(path.join(childAbsolute, "question.txt"), "utf8").catch(() => "");
          node.isDefaultContent = isDefaultQuestionText(questionRaw);
          node.questionText = normalizeQuestionTreeText(questionRaw);
        }

        node.children = await this.#buildTree(childAbsolute, childRelative, definitions);
        return node;
      }
    );

    return output;
  }
}

function toAdminFlag(flag) {
  return {
    name: flag.name,
    message: flag.message,
    colorClass: flag.colorClass,
    backgroundColor: flag.backgroundColor || "",
    iconClass: flag.iconClass || "",
    restrictionType: flag.restrictionType,
    allowedRoles: Array.isArray(flag.allowedRoles) ? [...flag.allowedRoles] : [],
    allowedUsers: Array.isArray(flag.allowedUsers) ? [...flag.allowedUsers] : []
  };
}

const DEFAULT_QUESTION_TEXT = "New question";
const DEFAULT_SOLUTION_HTML_VARIANTS = new Set(["<p></p>", "<p><br></p>"]);

function normalizeQuestion(value) {
  const trimmed = String(value || "").trim();
  return `${trimmed || DEFAULT_QUESTION_TEXT}\n`;
}

function isDefaultQuestionText(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === DEFAULT_QUESTION_TEXT.toLowerCase();
}

function isDefaultSolutionHtml(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();

  return DEFAULT_SOLUTION_HTML_VARIANTS.has(normalized);
}

function normalizeQuestionTreeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveBlockedReason({ parentNodeType, ancestorBlockedReason, nodeType }) {
  if (ancestorBlockedReason) {
    return ancestorBlockedReason;
  }

  if (parentNodeType === "terminal") {
    return "Descendant of a solution node.";
  }

  if (parentNodeType === "missing") {
    return "Ancestor node is missing question.txt or solution.html.";
  }

  if (nodeType === "missing") {
    return "Folder is missing question.txt or solution.html.";
  }

  return "";
}

function buildCaseCollisionLookup(dirEntriesInput) {
  const dirEntries = Array.isArray(dirEntriesInput) ? dirEntriesInput : [];
  if (!dirEntries.length) {
    return new Map();
  }

  const byLower = new Map();
  dirEntries.forEach((entry) => {
    const name = String(entry && entry.name ? entry.name : "").trim();
    if (!name) {
      return;
    }
    const key = name.toLowerCase();
    const list = byLower.get(key) || [];
    list.push(name);
    byLower.set(key, list);
  });

  const collisions = new Map();
  byLower.forEach((names) => {
    if (!Array.isArray(names) || names.length < 2) {
      return;
    }

    const uniqueNames = Array.from(new Set(names));
    if (uniqueNames.length < 2) {
      return;
    }

    uniqueNames.forEach((name) => {
      collisions.set(name, uniqueNames);
    });
  });

  return collisions;
}

function stripHtmlTextContent(htmlInput) {
  return String(htmlInput || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImageSources(htmlInput) {
  const html = String(htmlInput || "");
  const output = [];
  const seen = new Set();
  IMG_SRC_PATTERN.lastIndex = 0;

  let match;
  while ((match = IMG_SRC_PATTERN.exec(html)) !== null) {
    const source = String(match[1] || match[2] || match[3] || "").trim();
    if (!source || seen.has(source)) {
      continue;
    }
    seen.add(source);
    output.push(source);
  }

  return output;
}

function isLocalImageSource(sourceInput) {
  const source = String(sourceInput || "").trim().toLowerCase();
  if (!source) {
    return false;
  }

  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("//") || source.startsWith("data:") || source.startsWith("blob:")) {
    return false;
  }

  return true;
}

function resolveLocalImageSource(kbRootAbsolute, nodeAbsolutePath, sourceInput) {
  const source = String(sourceInput || "").trim();
  if (!source) {
    return { ok: false, reason: "Image src is empty." };
  }

  const withoutHash = source.split("#")[0] || "";
  const withoutQuery = withoutHash.split("?")[0] || "";
  const cleanedSource = withoutQuery.trim();
  if (!cleanedSource) {
    return { ok: false, reason: "Image src is empty." };
  }

  if (cleanedSource.startsWith("/api/asset/")) {
    const wildcard = cleanedSource.slice("/api/asset/".length);
    const decoded = wildcard
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })
      .join("/");

    const relative = normalizeKbRelativePath(decoded);
    if (!relative) {
      return { ok: false, reason: "Invalid /api/asset reference." };
    }

    try {
      const resolved = resolveKbPath(kbRootAbsolute, relative);
      return { ok: true, absolutePath: resolved.absolute, relativePath: resolved.relative };
    } catch {
      return { ok: false, reason: "Image path escapes Knowledgebase root." };
    }
  }

  if (cleanedSource.startsWith("/")) {
    return { ok: false, reason: "Root-relative path is outside /api/asset scope." };
  }

  const candidateAbsolute = path.resolve(nodeAbsolutePath, cleanedSource);
  const rootResolved = path.resolve(kbRootAbsolute);
  const rootPrefix = `${rootResolved}${path.sep}`;
  if (candidateAbsolute !== rootResolved && !candidateAbsolute.startsWith(rootPrefix)) {
    return { ok: false, reason: "Relative image path escapes Knowledgebase root." };
  }

  return {
    ok: true,
    absolutePath: candidateAbsolute,
    relativePath: normalizeKbRelativePath(path.relative(rootResolved, candidateAbsolute))
  };
}
function normalizeActor(value) {
  const actor = String(value || "").trim();
  return actor || "system";
}

async function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tempPath, payload, "utf8");

  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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

async function listChildFolders(absoluteDir) {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name);
}

async function setMarker(markerPath, enabled) {
  if (enabled) {
    await fs.writeFile(markerPath, "\n", "utf8");
    return;
  }
  await fs.unlink(markerPath).catch(() => {});
}

function uniqueUploadName(originalName) {
  const extension = path.extname(originalName);
  const base = path.basename(originalName, extension).replace(/[^A-Za-z0-9_-]/g, "-") || "image";
  const stamp = Date.now();
  return `${base}-${stamp}${extension.toLowerCase()}`;
}

module.exports = {
  KBAdminService
};

