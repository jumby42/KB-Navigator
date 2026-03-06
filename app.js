"use strict";
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
const DEFAULT_FLAG_COLOR = "#6c757d";
const DEFAULT_FLAG_BACKGROUND_COLOR = "#212529";
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const BOOTSTRAP_TEXT_COLOR_TO_HEX = Object.freeze({
  "text-primary": "#0d6efd",
  "text-secondary": "#6c757d",
  "text-success": "#198754",
  "text-danger": "#dc3545",
  "text-warning": "#ffc107",
  "text-info": "#0dcaf0",
  "text-light": "#f8f9fa",
  "text-dark": "#212529",
  "text-muted": "#6c757d",
  "text-white": "#ffffff"
});
const DEFAULT_AUTO_CONTRAST_STRICTNESS = 4.5;
const AUTO_CONTRAST_STRICTNESS_MIN = 2.5;
const AUTO_CONTRAST_STRICTNESS_MAX = 7.0;
const AUTO_CONTRAST_STRICTNESS_STEP = 0.1;
const DEFAULT_TREE_QUESTION_COLOR = "#000000";
const DEFAULT_TREE_SOLUTION_COLOR = "#000000";
const DEFAULT_TREE_HIGHLIGHT_COLOR_LIGHT = "#e9ecef";
const DEFAULT_TREE_QUESTION_SIZE_PX = 16;
const DEFAULT_TREE_SOLUTION_SIZE_PX = 14;
const DEFAULT_TREE_QUESTION_FONT_WEIGHT = "700";
const DEFAULT_TREE_SOLUTION_FONT_WEIGHT = "400";
const DEFAULT_TREE_QUESTION_FONT_STYLE = "normal";
const DEFAULT_TREE_SOLUTION_FONT_STYLE = "normal";
const DEFAULT_TREE_QUESTION_UNDERLINE = false;
const DEFAULT_TREE_SOLUTION_UNDERLINE = false;
const DEFAULT_TREE_QUESTION_TEXT_COLOR = "#444444";
const DEFAULT_TREE_QUESTION_TEXT_SIZE_PX = 11;
const DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT = "400";
const DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE = "normal";
const DEFAULT_TREE_QUESTION_TEXT_UNDERLINE = false;
const DEFAULT_SHOW_QUESTION_TEXT_IN_TREE = false;
const TREE_FONT_SIZE_MIN = 9;
const TREE_FONT_SIZE_MAX = 20;
const TREE_FONT_WEIGHT_OPTIONS = Object.freeze(["400", "500", "600", "700", "800"]);
const TREE_FONT_STYLE_OPTIONS = Object.freeze(["normal", "italic"]);
const UI_SETTING_STORAGE_KEYS = Object.freeze({
  autoContrastFlagBackground: "kbn.ui.autoContrastFlagBackground",
  autoContrastStrictness: "kbn.ui.autoContrastStrictness",
  treeQuestionColor: "kbn.ui.treeQuestionColor",
  treeSolutionColor: "kbn.ui.treeSolutionColor",
  treeHighlightColor: "kbn.ui.treeHighlightColor",
  treeQuestionFontWeight: "kbn.ui.treeQuestionFontWeight",
  treeQuestionFontStyle: "kbn.ui.treeQuestionFontStyle",
  treeSolutionFontWeight: "kbn.ui.treeSolutionFontWeight",
  treeSolutionFontStyle: "kbn.ui.treeSolutionFontStyle"
});
const THEME_STORAGE_KEY = "kbn.theme";
const THEME_MODES = Object.freeze(["light", "dim", "dark", "black"]);
const THEME_BOOTSTRAP_MODE = Object.freeze({
  light: "light",
  dim: "dark",
  dark: "dark",
  black: "dark"
});
const THEME_SURFACE_HEX = Object.freeze({
  light: "#ffffff",
  dim: "#2d3339",
  dark: "#212529",
  black: "#000000"
});
const LIGHT_THEME_CHIP_BACKGROUNDS = Object.freeze(["#212529", "#343a40", "#000000", "#495057"]);
const DARK_THEME_CHIP_BACKGROUNDS = Object.freeze(["#f8f9fa", "#ffffff", "#e9ecef", "#dee2e6"]);
const THEME_CHIP_BACKGROUNDS = Object.freeze({
  light: LIGHT_THEME_CHIP_BACKGROUNDS,
  dim: DARK_THEME_CHIP_BACKGROUNDS,
  dark: DARK_THEME_CHIP_BACKGROUNDS,
  black: DARK_THEME_CHIP_BACKGROUNDS
});
const BOOTSTRAP_ICON_CATALOG_URL = "/public/data/bootstrap-icons.json";
const BOOTSTRAP_ICON_CLASSES = [
  "bi-exclamation-triangle",
  "bi-exclamation-circle",
  "bi-info-circle",
  "bi-shield-exclamation",
  "bi-shield-lock",
  "bi-shield-check",
  "bi-lock",
  "bi-unlock",
  "bi-person-lock",
  "bi-tools",
  "bi-wrench",
  "bi-gear",
  "bi-gear-wide-connected",
  "bi-arrow-repeat",
  "bi-clock-history",
  "bi-lightning-charge",
  "bi-lightning-charge-fill",
  "bi-plug",
  "bi-plug-fill",
  "bi-wifi",
  "bi-cloud-check",
  "bi-cloud-slash",
  "bi-x-circle",
  "bi-check-circle",
  "bi-bell",
  "bi-bell-fill",
  "bi-bug",
  "bi-bug-fill",
  "bi-journal-text",
  "bi-file-earmark-text",
  "bi-slash-circle",
  "bi-patch-exclamation",
  "bi-patch-check",
  "bi-flag",
  "bi-flag-fill"
];

const SEARCH_MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_PAGE_SIZE = 25;
const ADMIN_COMPACT_BREAKPOINT_PX = 992;

const INTEGRITY_DEFAULT_QUESTION_TEXT = "new question";
const INTEGRITY_DEFAULT_SOLUTION_HTML_VARIANTS = new Set(["<p></p>", "<p><br></p>"]);
const INTEGRITY_HISTORY_MAX_ROWS = 5000;

const state = {
  auth: null,
  authMode: "optional",
  topics: [],
  steps: [],
  selectedPaths: [],
  terminal: null,
  modals: {},
  admin: {
    open: false,
    tree: null,
    selected: null,
    multiSelectItems: [],
    selectedTrashPaths: new Set(),
    modalContext: {},
    solutionPath: null,
    solutionDirty: false,
    solutionCloseAllowed: false,
    solutionEditSource: "published",
    solutionDraftMeta: null,
    draftChoiceResolver: null,
    reviewChoiceResolver: null,
    reviewStatus: null,
    pendingImageDeletes: [],
    heartbeatTimer: null,
    heartbeatSeconds: 120,
    lockContext: null,
    summernoteReady: false,
    ignoreSummernoteChange: false,
    suppressCloseCleanup: false,
    collapsedTreeKeys: new Set(),
    compactMode: false,
    compactPane: "tree",
    integrity: {
      running: false,
      stale: false,
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
    }
  },
  users: {
    open: false,
    list: []
  },
  performance: {
    open: false,
    runs: [],
    activeRun: null,
    selectedRunId: "",
    selectedRun: null,
    streamSource: null,
    streamRunId: "",
    liveEvent: null,
    customProfiles: [],
    detailMode: "beginner"
  },
  settings: {
    flags: [],
    allowedIconClasses: [...BOOTSTRAP_ICON_CLASSES],
    iconGlyphByClass: {},
    iconCatalogLoaded: false,
    reservedNames: [".lock"],
    editingFlagName: null,
    approvals: {
      flagEditsRequireApproval: false
    },
    backups: {
      settings: null,
      runtime: null,
      runs: [],
      activeRun: null,
      selectedRunId: "",
      selectedRun: null,
      streamSource: null,
      streamRunId: "",
      progressByRun: {},
      pendingRestoreRequest: null
    },
    audit: {
      settings: null,
      runtime: null,
      actions: [],
      rows: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
      filters: {
        actor: "",
        action: "",
        status: "",
        from: "",
        to: "",
        q: ""
      }
    }
  },
  reviews: {
    open: false,
    mine: [],
    pending: []
  },
  uiSettings: {
    autoContrastFlagBackground: true,
    autoContrastStrictness: DEFAULT_AUTO_CONTRAST_STRICTNESS,
    treeQuestionColor: DEFAULT_TREE_QUESTION_COLOR,
    treeSolutionColor: DEFAULT_TREE_SOLUTION_COLOR,
    treeHighlightColor: "",
    treeQuestionSizePx: DEFAULT_TREE_QUESTION_SIZE_PX,
    treeQuestionFontWeight: DEFAULT_TREE_QUESTION_FONT_WEIGHT,
    treeQuestionFontStyle: DEFAULT_TREE_QUESTION_FONT_STYLE,
    treeQuestionUnderline: DEFAULT_TREE_QUESTION_UNDERLINE,
    treeSolutionSizePx: DEFAULT_TREE_SOLUTION_SIZE_PX,
    treeSolutionFontWeight: DEFAULT_TREE_SOLUTION_FONT_WEIGHT,
    treeSolutionFontStyle: DEFAULT_TREE_SOLUTION_FONT_STYLE,
    treeSolutionUnderline: DEFAULT_TREE_SOLUTION_UNDERLINE,
    showQuestionTextInTree: DEFAULT_SHOW_QUESTION_TEXT_IN_TREE,
    treeQuestionTextColor: DEFAULT_TREE_QUESTION_TEXT_COLOR,
    treeQuestionTextSizePx: DEFAULT_TREE_QUESTION_TEXT_SIZE_PX,
    treeQuestionTextFontWeight: DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT,
    treeQuestionTextFontStyle: DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE,
    treeQuestionTextUnderline: DEFAULT_TREE_QUESTION_TEXT_UNDERLINE
  },
  search: {
    query: "",
    page: 1,
    pageSize: SEARCH_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    results: [],
    loading: false,
    open: false,
    error: "",
    debounceTimer: null,
    requestToken: 0
  },
  landing: {
    dismissed: false,
    solutionCount: 0
  },
  theme: "light",
  overlayFocus: {
    activeElement: null,
    keydownHandler: null,
    restoreFocus: null
  }
};

const els = {
  navActions: document.getElementById("navActions"),
  navSearchForm: document.getElementById("navSearchForm"),
  navSearchInput: document.getElementById("navSearchInput"),
  navSearchResults: document.getElementById("navSearchResults"),
  setupSection: document.getElementById("setupSection"),
  appSection: document.getElementById("appSection"),
  setupForm: document.getElementById("setupForm"),
  setupMessage: document.getElementById("setupMessage"),
  steps: document.getElementById("steps"),
  solutionPane: document.getElementById("solutionPane"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  landingSection: document.getElementById("landingSection"),
  troubleshooterFlow: document.getElementById("troubleshooterFlow"),
  landingTitle: document.getElementById("landingTitle"),
  landingSubtitle: document.getElementById("landingSubtitle"),
  landingPrimaryBtn: document.getElementById("landingPrimaryBtn"),
  landingTopicCount: document.getElementById("landingTopicCount"),
  landingTopicsList: document.getElementById("landingTopicsList"),
  loginForm: document.getElementById("loginForm"),
  loginMessage: document.getElementById("loginMessage"),
  toastContainer: document.getElementById("toastContainer"),

  adminOverlay: document.getElementById("adminOverlay"),
  adminCloseBtn: document.getElementById("adminCloseBtn"),
  adminRefreshBtn: document.getElementById("adminRefreshBtn"),
  adminIntegrityScanBtn: document.getElementById("adminIntegrityScanBtn"),
  adminMySubmissionsBtn: document.getElementById("adminMySubmissionsBtn"),
  adminIntegrityMessage: document.getElementById("adminIntegrityMessage"),
  adminIntegritySummary: document.getElementById("adminIntegritySummary"),
  adminIntegrityRows: document.getElementById("adminIntegrityRows"),
  adminIntegrityRescanBtn: document.getElementById("adminIntegrityRescanBtn"),
  adminIntegrityExportBtn: document.getElementById("adminIntegrityExportBtn"),
  adminIntegrityClearHistoryBtn: document.getElementById("adminIntegrityClearHistoryBtn"),
  adminTreeExpandAllBtn: document.getElementById("adminTreeExpandAllBtn"),
  adminTreeCollapseAllBtn: document.getElementById("adminTreeCollapseAllBtn"),
  adminTreeClearIntegrityBtn: document.getElementById("adminTreeClearIntegrityBtn"),
  adminKbTree: document.getElementById("adminKbTree"),
  adminTrashTree: document.getElementById("adminTrashTree"),
  adminSelectionTitle: document.getElementById("adminSelectionTitle"),
  adminSelectionSub: document.getElementById("adminSelectionSub"),
  adminActionBar: document.getElementById("adminActionBar"),
  adminPanelBody: document.getElementById("adminPanelBody"),
  adminCompactPaneSwitch: document.getElementById("adminCompactPaneSwitch"),
  adminPaneTreeBtn: document.getElementById("adminPaneTreeBtn"),
  adminPaneEditorBtn: document.getElementById("adminPaneEditorBtn"),
  adminTreePane: document.getElementById("adminTreePane"),
  adminEditorPane: document.getElementById("adminEditorPane"),

  usersOverlay: document.getElementById("usersOverlay"),
  usersCloseBtn: document.getElementById("usersCloseBtn"),
  usersRefreshBtn: document.getElementById("usersRefreshBtn"),
  usersTableBody: document.getElementById("usersTableBody"),
  createUserForm: document.getElementById("createUserForm"),
  createRole: document.getElementById("createRole"),
  createCanApprove: document.getElementById("createCanApprove"),
  usersCreateMessage: document.getElementById("usersCreateMessage"),
  usersTempPasswordBox: document.getElementById("usersTempPasswordBox"),

  settingsForm: document.getElementById("settingsForm"),
  settingsMessage: document.getElementById("settingsMessage"),
  settingsFlagsSection: document.getElementById("settingsFlagsSection"),
  settingsFlagsMessage: document.getElementById("settingsFlagsMessage"),
  settingsFlagEditsRequireApproval: document.getElementById("settingsFlagEditsRequireApproval"),
  settingsAutoContrastFlagBackground: document.getElementById("settingsAutoContrastFlagBackground"),
  settingsThemeMode: document.getElementById("settingsThemeMode"),
  settingsTreeAppearanceSection: document.getElementById("settingsTreeAppearanceSection"),
  settingsShowQuestionTextInTree: document.getElementById("settingsShowQuestionTextInTree"),
  settingsTreeQuestionColor: document.getElementById("settingsTreeQuestionColor"),
  settingsTreeSolutionColor: document.getElementById("settingsTreeSolutionColor"),
  settingsTreeQuestionTextSection: document.getElementById("settingsTreeQuestionTextSection"),
  settingsTreeQuestionTextColor: document.getElementById("settingsTreeQuestionTextColor"),
  settingsTreeHighlightColor: document.getElementById("settingsTreeHighlightColor"),
  settingsTreeQuestionSize: document.getElementById("settingsTreeQuestionSize"),
  settingsTreeSolutionSize: document.getElementById("settingsTreeSolutionSize"),
  settingsTreeQuestionTextSize: document.getElementById("settingsTreeQuestionTextSize"),
  settingsTreeQuestionBold: document.getElementById("settingsTreeQuestionBold"),
  settingsTreeQuestionItalic: document.getElementById("settingsTreeQuestionItalic"),
  settingsTreeQuestionUnderline: document.getElementById("settingsTreeQuestionUnderline"),
  settingsTreeSolutionBold: document.getElementById("settingsTreeSolutionBold"),
  settingsTreeSolutionItalic: document.getElementById("settingsTreeSolutionItalic"),
  settingsTreeSolutionUnderline: document.getElementById("settingsTreeSolutionUnderline"),
  settingsTreeQuestionTextBold: document.getElementById("settingsTreeQuestionTextBold"),
  settingsTreeQuestionTextItalic: document.getElementById("settingsTreeQuestionTextItalic"),
  settingsTreeQuestionTextUnderline: document.getElementById("settingsTreeQuestionTextUnderline"),
  settingsTreeResetDefaultsBtn: document.getElementById("settingsTreeResetDefaultsBtn"),
  settingsAutoContrastStrictnessWrap: document.getElementById("settingsAutoContrastStrictnessWrap"),
  settingsAutoContrastStrictness: document.getElementById("settingsAutoContrastStrictness"),
  settingsOpenCreateFlagBtn: document.getElementById("settingsOpenCreateFlagBtn"),
  settingsFlagsList: document.getElementById("settingsFlagsList"),
  settingsFlagForm: document.getElementById("settingsFlagForm"),
  settingsFlagFormTitle: document.getElementById("settingsFlagFormTitle"),
  settingsFlagName: document.getElementById("settingsFlagName"),
  settingsFlagMessage: document.getElementById("settingsFlagMessage"),
  settingsFlagColor: document.getElementById("settingsFlagColor"),
  settingsFlagBackgroundEnabled: document.getElementById("settingsFlagBackgroundEnabled"),
  settingsFlagBackgroundColor: document.getElementById("settingsFlagBackgroundColor"),
  settingsFlagBackgroundWrap: document.getElementById("settingsFlagBackgroundWrap"),
  settingsFlagIcon: document.getElementById("settingsFlagIcon"),
  settingsFlagIconSearch: document.getElementById("settingsFlagIconSearch"),
  settingsFlagIconGrid: document.getElementById("settingsFlagIconGrid"),
  settingsFlagIconCurrent: document.getElementById("settingsFlagIconCurrent"),
  settingsFlagIconClear: document.getElementById("settingsFlagIconClear"),
  settingsFlagRestrictionType: document.getElementById("settingsFlagRestrictionType"),
  settingsFlagRolesWrap: document.getElementById("settingsFlagRolesWrap"),
  settingsFlagRoleUser: document.getElementById("settingsFlagRoleUser"),
  settingsFlagRoleAdmin: document.getElementById("settingsFlagRoleAdmin"),
  settingsFlagRoleSuperadmin: document.getElementById("settingsFlagRoleSuperadmin"),
  settingsFlagUsersWrap: document.getElementById("settingsFlagUsersWrap"),
  settingsFlagUsersList: document.getElementById("settingsFlagUsersList"),
  settingsFlagPreview: document.getElementById("settingsFlagPreview"),
  settingsFlagFormMessage: document.getElementById("settingsFlagFormMessage"),
  settingsFlagSaveBtn: document.getElementById("settingsFlagSaveBtn"),
  settingsFlagCancelBtn: document.getElementById("settingsFlagCancelBtn"),
  settingsBackupsSection: document.getElementById("settingsBackupsSection"),
  settingsBackupsInlineRuntime: document.getElementById("settingsBackupsInlineRuntime"),
  settingsOpenBackupManagerBtn: document.getElementById("settingsOpenBackupManagerBtn"),
  settingsBackupRuntime: document.getElementById("settingsBackupRuntime"),
  settingsBackupScheduleEnabled: document.getElementById("settingsBackupScheduleEnabled"),
  settingsBackupPreset: document.getElementById("settingsBackupPreset"),
  settingsBackupRetentionMode: document.getElementById("settingsBackupRetentionMode"),
  settingsBackupKeepLastWrap: document.getElementById("settingsBackupKeepLastWrap"),
  settingsBackupKeepLast: document.getElementById("settingsBackupKeepLast"),
  settingsBackupMaxAgeDaysWrap: document.getElementById("settingsBackupMaxAgeDaysWrap"),
  settingsBackupMaxAgeDays: document.getElementById("settingsBackupMaxAgeDays"),
  settingsBackupLabel: document.getElementById("settingsBackupLabel"),
  settingsBackupCreateBtn: document.getElementById("settingsBackupCreateBtn"),
  settingsBackupRestoreSource: document.getElementById("settingsBackupRestoreSource"),
  settingsBackupRestoreExistingWrap: document.getElementById("settingsBackupRestoreExistingWrap"),
  settingsBackupRestoreExisting: document.getElementById("settingsBackupRestoreExisting"),
  settingsBackupRestoreFileWrap: document.getElementById("settingsBackupRestoreFileWrap"),
  settingsBackupRestoreFile: document.getElementById("settingsBackupRestoreFile"),
  settingsBackupRestoreConfirmSummary: document.getElementById("settingsBackupRestoreConfirmSummary"),
  settingsBackupRestoreConfirmInput: document.getElementById("settingsBackupRestoreConfirmInput"),
  settingsBackupRestoreConfirmMessage: document.getElementById("settingsBackupRestoreConfirmMessage"),
  settingsBackupRestoreBtn: document.getElementById("settingsBackupRestoreBtn"),
  settingsBackupRestoreConfirmSubmitBtn: document.getElementById("settingsBackupRestoreConfirmSubmitBtn"),
  settingsBackupRefreshBtn: document.getElementById("settingsBackupRefreshBtn"),
  settingsBackupRunsBody: document.getElementById("settingsBackupRunsBody"),
  settingsBackupDetail: document.getElementById("settingsBackupDetail"),
  settingsBackupsMessage: document.getElementById("settingsBackupsMessage"),
  settingsAuditSection: document.getElementById("settingsAuditSection"),
  settingsAuditRoleNote: document.getElementById("settingsAuditRoleNote"),
  settingsAuditRuntime: document.getElementById("settingsAuditRuntime"),
  settingsAuditRetentionWrap: document.getElementById("settingsAuditRetentionWrap"),
  settingsAuditRetentionDays: document.getElementById("settingsAuditRetentionDays"),
  settingsOpenAuditLogBtn: document.getElementById("settingsOpenAuditLogBtn"),
  auditFilterActor: document.getElementById("auditFilterActor"),
  auditFilterAction: document.getElementById("auditFilterAction"),
  auditFilterStatus: document.getElementById("auditFilterStatus"),
  auditFilterFrom: document.getElementById("auditFilterFrom"),
  auditFilterTo: document.getElementById("auditFilterTo"),
  auditFilterQuery: document.getElementById("auditFilterQuery"),
  auditApplyBtn: document.getElementById("auditApplyBtn"),
  auditResetBtn: document.getElementById("auditResetBtn"),
  auditExportBtn: document.getElementById("auditExportBtn"),
  auditRows: document.getElementById("auditRows"),
  auditSummary: document.getElementById("auditSummary"),
  auditModalMessage: document.getElementById("auditModalMessage"),
  auditPaginationLabel: document.getElementById("auditPaginationLabel"),
  auditPrevBtn: document.getElementById("auditPrevBtn"),
  auditNextBtn: document.getElementById("auditNextBtn"),

  topicForm: document.getElementById("topicForm"),
  topicMessage: document.getElementById("topicMessage"),
  topicAddAnswerRowBtn: document.getElementById("topicAddAnswerRowBtn"),
  topicAnswerRows: document.getElementById("topicAnswerRows"),
  answerForm: document.getElementById("answerForm"),
  answerMessage: document.getElementById("answerMessage"),
  answerAddRowBtn: document.getElementById("answerAddRowBtn"),
  answerRows: document.getElementById("answerRows"),
  renameForm: document.getElementById("renameForm"),
  renameMessage: document.getElementById("renameMessage"),
  moveQuestionForm: document.getElementById("moveQuestionForm"),
  moveQuestionSource: document.getElementById("moveQuestionSource"),
  moveQuestionDestination: document.getElementById("moveQuestionDestination"),
  moveQuestionMessage: document.getElementById("moveQuestionMessage"),
  questionForm: document.getElementById("questionForm"),
  questionText: document.getElementById("questionText"),
  questionMessage: document.getElementById("questionMessage"),
  solutionMessage: document.getElementById("solutionMessage"),
  solutionReviewBanner: document.getElementById("solutionReviewBanner"),
  draftBanner: document.getElementById("draftBanner"),
  solutionFlagsSection: document.getElementById("solutionFlagsSection"),
  solutionFlagsEditor: document.getElementById("solutionFlagsEditor"),
  solutionFlagsMessage: document.getElementById("solutionFlagsMessage"),

  solutionSaveDraftBtn: document.getElementById("solutionSaveDraftBtn"),
  solutionDiscardDraftBtn: document.getElementById("solutionDiscardDraftBtn"),
  solutionExistingImagesRefreshBtn: document.getElementById("solutionExistingImagesRefreshBtn"),
  solutionDraftChoiceMessage: document.getElementById("solutionDraftChoiceMessage"),
  solutionDraftChoicePublishedBtn: document.getElementById("solutionDraftChoicePublishedBtn"),
  solutionDraftChoiceDraftBtn: document.getElementById("solutionDraftChoiceDraftBtn"),
  solutionDraftChoiceCancelBtn: document.getElementById("solutionDraftChoiceCancelBtn"),
  solutionReviewChoiceMessage: document.getElementById("solutionReviewChoiceMessage"),
  solutionReviewChoicePublishedBtn: document.getElementById("solutionReviewChoicePublishedBtn"),
  solutionReviewChoiceRejectedBtn: document.getElementById("solutionReviewChoiceRejectedBtn"),
  solutionReviewChoiceCancelBtn: document.getElementById("solutionReviewChoiceCancelBtn"),
  solutionExistingImagesMessage: document.getElementById("solutionExistingImagesMessage"),
  solutionExistingImagesList: document.getElementById("solutionExistingImagesList"),
  solutionPublishBtn: document.getElementById("solutionPublishBtn"),
  solutionCloseBtn: document.getElementById("solutionCloseBtn"),

  lockMessage: document.getElementById("lockMessage"),
  lockRefreshBtn: document.getElementById("lockRefreshBtn"),
  lockForceBtn: document.getElementById("lockForceBtn"),

  restoreForm: document.getElementById("restoreForm"),
  restoreMode: document.getElementById("restoreMode"),
  restoreDestination: document.getElementById("restoreDestination"),
  restoreNewRootWrap: document.getElementById("restoreNewRootWrap"),
  restorePreflightRows: document.getElementById("restorePreflightRows"),
  restoreSubmitBtn: document.getElementById("restoreSubmitBtn"),
  restoreItemLabel: document.getElementById("restoreItemLabel"),
  restoreMessage: document.getElementById("restoreMessage"),

  mySubmissionsSummary: document.getElementById("mySubmissionsSummary"),
  mySubmissionsRows: document.getElementById("mySubmissionsRows"),
  mySubmissionsRefreshBtn: document.getElementById("mySubmissionsRefreshBtn"),
  mySubmissionsMessage: document.getElementById("mySubmissionsMessage"),
  reviewQueueTabWrap: document.getElementById("reviewQueueTabWrap"),
  reviewQueueRows: document.getElementById("reviewQueueRows"),
  reviewQueueSummary: document.getElementById("reviewQueueSummary"),
  reviewQueueRefreshBtn: document.getElementById("reviewQueueRefreshBtn"),
  submissionViewMeta: document.getElementById("submissionViewMeta"),
  submissionViewSubmitted: document.getElementById("submissionViewSubmitted"),
  submissionViewPublished: document.getElementById("submissionViewPublished"),
  submissionViewMessage: document.getElementById("submissionViewMessage"),

  unsavedSaveBtn: document.getElementById("unsavedSaveBtn"),
  unsavedDiscardBtn: document.getElementById("unsavedDiscardBtn"),
  unsavedCancelBtn: document.getElementById("unsavedCancelBtn")
};

document.addEventListener("DOMContentLoaded", async () => {
  initializeModals();
  bindEventHandlers();
  initializeBootstrapTooltips();
  initializeTheme();
  syncOverlayScrollLock();
  await boot();
});

function initializeModals() {
  state.modals.login = new bootstrap.Modal(document.getElementById("loginModal"));
  state.modals.settings = new bootstrap.Modal(document.getElementById("settingsModal"));
  state.modals.adminIntegrity = new bootstrap.Modal(document.getElementById("adminIntegrityModal"));
  state.modals.backupManager = new bootstrap.Modal(document.getElementById("backupManagerModal"));
  state.modals.backupRestoreConfirm = new bootstrap.Modal(document.getElementById("backupRestoreConfirmModal"));
  state.modals.flagEditor = new bootstrap.Modal(document.getElementById("flagEditorModal"));
  state.modals.topic = new bootstrap.Modal(document.getElementById("topicModal"));
  state.modals.answer = new bootstrap.Modal(document.getElementById("answerModal"));
  state.modals.rename = new bootstrap.Modal(document.getElementById("renameModal"));
  state.modals.moveQuestion = new bootstrap.Modal(document.getElementById("moveQuestionModal"));
  state.modals.question = new bootstrap.Modal(document.getElementById("questionModal"));
  state.modals.solution = new bootstrap.Modal(document.getElementById("solutionModal"));
  state.modals.solutionDraftChoice = new bootstrap.Modal(document.getElementById("solutionDraftChoiceModal"));
  state.modals.solutionReviewChoice = new bootstrap.Modal(document.getElementById("solutionReviewChoiceModal"));
  state.modals.solutionExistingImages = new bootstrap.Modal(document.getElementById("solutionExistingImagesModal"));
  state.modals.lock = new bootstrap.Modal(document.getElementById("lockModal"));
  state.modals.restore = new bootstrap.Modal(document.getElementById("restoreModal"));
  state.modals.mySubmissions = new bootstrap.Modal(document.getElementById("mySubmissionsModal"));
  state.modals.audit = new bootstrap.Modal(document.getElementById("auditLogModal"));
  state.modals.submissionView = new bootstrap.Modal(document.getElementById("submissionViewModal"));
  state.modals.unsaved = new bootstrap.Modal(document.getElementById("unsavedModal"));

  const solutionModalElement = document.getElementById("solutionModal");
  solutionModalElement.addEventListener("shown.bs.modal", onSolutionModalShown);
  solutionModalElement.addEventListener("hide.bs.modal", onSolutionModalHide);
  solutionModalElement.addEventListener("hidden.bs.modal", onSolutionModalHidden);
  document.getElementById("solutionDraftChoiceModal").addEventListener("hidden.bs.modal", onSolutionDraftChoiceModalHidden);
  document.getElementById("solutionReviewChoiceModal").addEventListener("hidden.bs.modal", onSolutionReviewChoiceModalHidden);
  document.getElementById("flagEditorModal").addEventListener("hidden.bs.modal", onFlagEditorModalHidden);
  document.getElementById("backupManagerModal").addEventListener("hidden.bs.modal", closeSettingsBackupStream);
  document.getElementById("backupRestoreConfirmModal").addEventListener("hidden.bs.modal", onBackupRestoreConfirmModalHidden);
  document.getElementById("mySubmissionsModal").addEventListener("hidden.bs.modal", onMySubmissionsModalHidden);
  document.getElementById("auditLogModal").addEventListener("hidden.bs.modal", onAuditLogModalHidden);
}

function bindEventHandlers() {
  els.setupForm.addEventListener("submit", onSetupSubmit);
  initializeA11yMessageRegions();
  els.loginForm.addEventListener("submit", onLoginSubmit);
  if (els.navSearchForm) {
    els.navSearchForm.addEventListener("submit", onNavSearchSubmit);
  }
  if (els.navSearchInput) {
    els.navSearchInput.addEventListener("input", onNavSearchInputChanged);
    els.navSearchInput.addEventListener("focus", onNavSearchInputFocused);
    els.navSearchInput.addEventListener("keydown", onNavSearchInputKeydown);
  }
  if (els.navSearchResults) {
    els.navSearchResults.addEventListener("click", onNavSearchResultsClick);
    els.navSearchResults.addEventListener("keydown", onNavSearchResultsKeydown);
  }
  document.addEventListener("click", onGlobalClickForSearchDismiss);
  document.addEventListener("keydown", onGlobalKeydownForSearchDismiss);
  if (els.landingPrimaryBtn) {
    els.landingPrimaryBtn.addEventListener("click", onLandingPrimaryClicked);
  }
  if (els.landingTopicsList) {
    els.landingTopicsList.addEventListener("click", onLandingTopicsClick);
  }


  els.adminCloseBtn.addEventListener("click", closeAdminOverlay);
  if (els.adminIntegrityScanBtn) {
    els.adminIntegrityScanBtn.addEventListener("click", () => {
      openAdminIntegrityModal().catch(() => {});
    });
  }
  if (els.adminMySubmissionsBtn) {
    els.adminMySubmissionsBtn.addEventListener("click", () => {
      openMySubmissionsModal().catch(() => {});
    });
  }
  if (els.adminIntegrityRescanBtn) {
    els.adminIntegrityRescanBtn.addEventListener("click", () => {
      runAdminIntegrityScan({ force: true, announce: false }).catch(() => {});
    });
  }
  if (els.adminIntegrityExportBtn) {
    els.adminIntegrityExportBtn.addEventListener("click", () => {
      exportAdminIntegrityCsv();
    });
  }
  if (els.adminIntegrityClearHistoryBtn) {
    els.adminIntegrityClearHistoryBtn.addEventListener("click", () => {
      clearAdminIntegrityHistory().catch(() => {});
    });
  }
  els.adminRefreshBtn.addEventListener("click", async () => {
    markAdminIntegrityStale();
    await loadAdminTree();
    renderAdminTree();
    await renderAdminSelection();
    renderAdminIntegrityModal();
  });
  if (els.adminTreeExpandAllBtn) {
    els.adminTreeExpandAllBtn.addEventListener("click", () => {
      setAllTreeNodesCollapsed(false);
      renderAdminTree();
    });
  }
  if (els.adminTreeCollapseAllBtn) {
    els.adminTreeCollapseAllBtn.addEventListener("click", () => {
      setAllTreeNodesCollapsed(true);
      renderAdminTree();
    });
  }
  if (els.adminTreeClearIntegrityBtn) {
    els.adminTreeClearIntegrityBtn.addEventListener("click", () => {
      clearAllAdminIntegrityIndicators();
    });
  }
  if (els.adminPaneTreeBtn) {
    els.adminPaneTreeBtn.addEventListener("click", () => {
      setAdminCompactPane("tree", { focus: true });
    });
  }
  if (els.adminPaneEditorBtn) {
    els.adminPaneEditorBtn.addEventListener("click", () => {
      setAdminCompactPane("editor", { focus: true });
    });
  }
  window.addEventListener("resize", onWindowResize);

  els.usersCloseBtn.addEventListener("click", closeUsersOverlay);
  els.usersRefreshBtn.addEventListener("click", openUsersOverlay);

  els.settingsForm.addEventListener("submit", onSettingsSubmit);
  if (els.settingsFlagForm) {
    els.settingsFlagForm.addEventListener("submit", onSettingsFlagSubmit);
  }
  if (els.settingsOpenCreateFlagBtn) {
    els.settingsOpenCreateFlagBtn.addEventListener("click", openCreateFlagEditorModal);
  }
  if (els.settingsFlagRestrictionType) {
    els.settingsFlagRestrictionType.addEventListener("change", onSettingsFlagRestrictionChanged);
  }
  if (els.settingsFlagCancelBtn) {
    els.settingsFlagCancelBtn.addEventListener("click", closeFlagEditorModal);
  }
  if (els.settingsFlagBackgroundEnabled) {
    els.settingsFlagBackgroundEnabled.addEventListener("change", onSettingsFlagBackgroundEnabledChanged);
  }
  if (els.settingsFlagIconSearch) {
    els.settingsFlagIconSearch.addEventListener("input", ensureSettingsIconOptions);
  }
  if (els.settingsFlagIconClear) {
    els.settingsFlagIconClear.addEventListener("click", () => setSettingsFlagIcon(""));
  }
  if (els.settingsFlagUsersList) {
    els.settingsFlagUsersList.addEventListener("change", (event) => {
      const target = event && event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      if (!target.classList.contains("kbn-user-select-checkbox")) {
        return;
      }
      renderSettingsFlagPreview();
    });
  }
  if (els.settingsAutoContrastFlagBackground) {
    els.settingsAutoContrastFlagBackground.addEventListener("change", onSettingsAutoContrastToggled);
  }
  if (els.settingsFlagEditsRequireApproval) {
    els.settingsFlagEditsRequireApproval.addEventListener("change", () => {
      onSettingsApprovalToggleChanged().catch(() => {});
    });
  }
  if (els.settingsThemeMode) {
    els.settingsThemeMode.addEventListener("change", onSettingsThemeModeChanged);
  }
  [
    els.settingsShowQuestionTextInTree,
    els.settingsTreeQuestionColor,
    els.settingsTreeQuestionSize,
    els.settingsTreeSolutionColor,
    els.settingsTreeSolutionSize,
    els.settingsTreeQuestionTextColor,
    els.settingsTreeQuestionTextSize,
    els.settingsTreeHighlightColor
  ].forEach((el) => {
    if (!el) {
      return;
    }
    el.addEventListener("change", onSettingsTreeAppearanceChanged);
  });

  [
    els.settingsTreeQuestionBold,
    els.settingsTreeQuestionItalic,
    els.settingsTreeQuestionUnderline,
    els.settingsTreeSolutionBold,
    els.settingsTreeSolutionItalic,
    els.settingsTreeSolutionUnderline,
    els.settingsTreeQuestionTextBold,
    els.settingsTreeQuestionTextItalic,
    els.settingsTreeQuestionTextUnderline
  ].forEach((button) => {
    if (!button) {
      return;
    }
    button.addEventListener("click", onSettingsTreeStyleButtonClick);
  });

  if (els.settingsTreeResetDefaultsBtn) {
    els.settingsTreeResetDefaultsBtn.addEventListener("click", () => {
      onSettingsTreeResetDefaults().catch(() => {});
    });
  }
  if (els.settingsAutoContrastStrictness) {
    els.settingsAutoContrastStrictness.addEventListener("change", onSettingsAutoContrastStrictnessChanged);
  }

  if (els.settingsOpenBackupManagerBtn) {
    els.settingsOpenBackupManagerBtn.addEventListener("click", () => {
      openBackupManagerModal().catch(() => {});
    });
  }

  [
    els.settingsBackupScheduleEnabled,
    els.settingsBackupPreset,
    els.settingsBackupKeepLast,
    els.settingsBackupMaxAgeDays
  ].forEach((el) => {
    if (!el) {
      return;
    }
    el.addEventListener("change", () => {
      onSettingsBackupSettingsChanged().catch(() => {});
    });
  });

  if (els.settingsBackupRetentionMode) {
    els.settingsBackupRetentionMode.addEventListener("change", onSettingsBackupRetentionModeChanged);
  }
  if (els.settingsBackupCreateBtn) {
    els.settingsBackupCreateBtn.addEventListener("click", () => {
      onSettingsBackupCreateClicked().catch(() => {});
    });
  }
  if (els.settingsBackupRestoreSource) {
    els.settingsBackupRestoreSource.addEventListener("change", syncSettingsBackupRestoreInputs);
  }
  if (els.settingsBackupRestoreBtn) {
    els.settingsBackupRestoreBtn.addEventListener("click", () => {
      openSettingsBackupRestoreConfirmModal();
    });
  }
  if (els.settingsBackupRestoreConfirmSubmitBtn) {
    els.settingsBackupRestoreConfirmSubmitBtn.addEventListener("click", () => {
      onSettingsBackupRestoreClicked().catch(() => {});
    });
  }
  if (els.settingsBackupRestoreConfirmInput) {
    els.settingsBackupRestoreConfirmInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSettingsBackupRestoreClicked().catch(() => {});
      }
    });
  }
  if (els.settingsBackupRefreshBtn) {
    els.settingsBackupRefreshBtn.addEventListener("click", () => {
      refreshSettingsBackups(false).catch(() => {});
    });
  }
  if (els.settingsBackupRunsBody) {
    els.settingsBackupRunsBody.addEventListener("click", onSettingsBackupRunsTableClick);
  }

  if (els.settingsOpenAuditLogBtn) {
    els.settingsOpenAuditLogBtn.addEventListener("click", () => {
      openAuditLogModal().catch(() => {});
    });
  }
  if (els.settingsAuditRetentionDays) {
    els.settingsAuditRetentionDays.addEventListener("change", () => {
      onSettingsAuditRetentionChanged().catch(() => {});
    });
  }
  if (els.auditApplyBtn) {
    els.auditApplyBtn.addEventListener("click", () => {
      refreshAuditEvents(1).catch(() => {});
    });
  }
  if (els.auditResetBtn) {
    els.auditResetBtn.addEventListener("click", () => {
      resetAuditFilters();
      refreshAuditEvents(1).catch(() => {});
    });
  }
  if (els.auditExportBtn) {
    els.auditExportBtn.addEventListener("click", () => {
      exportAuditCsv().catch(() => {});
    });
  }
  if (els.auditPrevBtn) {
    els.auditPrevBtn.addEventListener("click", () => {
      refreshAuditEvents(Math.max(1, Number(state.settings.audit.page || 1) - 1)).catch(() => {});
    });
  }
  if (els.auditNextBtn) {
    els.auditNextBtn.addEventListener("click", () => {
      const page = Number(state.settings.audit.page || 1);
      const totalPages = Number(state.settings.audit.totalPages || 1);
      refreshAuditEvents(Math.min(totalPages, page + 1)).catch(() => {});
    });
  }

  [
    els.settingsFlagName,
    els.settingsFlagMessage,
    els.settingsFlagColor,
    els.settingsFlagBackgroundColor,
    els.settingsFlagRoleUser,
    els.settingsFlagRoleAdmin,
    els.settingsFlagRoleSuperadmin
  ].forEach((el) => {
    if (!el) {
      return;
    }
    el.addEventListener("input", renderSettingsFlagPreview);
    el.addEventListener("change", renderSettingsFlagPreview);
  });

  if (els.topicAddAnswerRowBtn) {
    els.topicAddAnswerRowBtn.addEventListener("click", () => appendBatchAnswerRow(els.topicAnswerRows));
  }
  if (els.answerAddRowBtn) {
    els.answerAddRowBtn.addEventListener("click", () => appendBatchAnswerRow(els.answerRows));
  }
  [els.topicAnswerRows, els.answerRows].forEach((container) => {
    if (!container) {
      return;
    }
    container.addEventListener("click", onBatchAnswerRowsClick);
    container.addEventListener("input", onBatchAnswerRowsInputChange);
    container.addEventListener("change", onBatchAnswerRowsInputChange);
  });

  els.topicForm.addEventListener("submit", onCreateTopicSubmit);
  els.answerForm.addEventListener("submit", onCreateAnswerSubmit);
  els.renameForm.addEventListener("submit", onRenameSubmit);
  if (els.moveQuestionForm) {
    els.moveQuestionForm.addEventListener("submit", onMoveQuestionSubmit);
  }
  els.questionForm.addEventListener("submit", onQuestionSaveSubmit);

  els.solutionSaveDraftBtn.addEventListener("click", onSaveDraftClicked);
  els.solutionDiscardDraftBtn.addEventListener("click", onDiscardDraftClicked);
  if (els.solutionExistingImagesRefreshBtn) {
    els.solutionExistingImagesRefreshBtn.addEventListener("click", () => {
      loadSolutionExistingImages().catch(() => {});
    });
  }
  if (els.solutionExistingImagesList) {
    els.solutionExistingImagesList.addEventListener("click", onSolutionExistingImagesListClicked);
  }
  els.solutionPublishBtn.addEventListener("click", onPublishClicked);
  els.solutionCloseBtn.addEventListener("click", () => state.modals.solution.hide());
  if (els.solutionDraftChoicePublishedBtn) {
    els.solutionDraftChoicePublishedBtn.addEventListener("click", () => resolveSolutionDraftChoice("published"));
  }
  if (els.solutionDraftChoiceDraftBtn) {
    els.solutionDraftChoiceDraftBtn.addEventListener("click", () => resolveSolutionDraftChoice("draft"));
  }
  if (els.solutionDraftChoiceCancelBtn) {
    els.solutionDraftChoiceCancelBtn.addEventListener("click", () => resolveSolutionDraftChoice("cancel"));
  }
  els.lockRefreshBtn.addEventListener("click", onLockRefreshClicked);
  els.lockForceBtn.addEventListener("click", onLockForceClicked);

  els.restoreForm.addEventListener("submit", onRestoreSubmit);
  if (els.restoreMode) {
    els.restoreMode.addEventListener("change", onRestorePlanInputsChanged);
  }
  if (els.restoreDestination) {
    els.restoreDestination.addEventListener("change", onRestorePlanInputsChanged);
  }

  els.unsavedSaveBtn.addEventListener("click", async () => {
    const ok = await saveDraft();
    if (!ok) {
      return;
    }
    state.modals.unsaved.hide();
    state.admin.solutionCloseAllowed = true;
    state.modals.solution.hide();
  });
  els.unsavedDiscardBtn.addEventListener("click", () => {
    state.modals.unsaved.hide();
    state.admin.solutionCloseAllowed = true;
    state.modals.solution.hide();
  });
  els.unsavedCancelBtn.addEventListener("click", () => {
    state.modals.unsaved.hide();
  });

  els.createUserForm.addEventListener("submit", onCreateUserSubmit);
  if (els.createRole) {
    els.createRole.addEventListener("change", syncCreateApproverControl);
  }

  if (els.mySubmissionsRefreshBtn) {
    els.mySubmissionsRefreshBtn.addEventListener("click", () => {
      refreshMySubmissionsModal().catch(() => {});
    });
  }
  if (els.reviewQueueRefreshBtn) {
    els.reviewQueueRefreshBtn.addEventListener("click", () => {
      refreshMySubmissionsModal().catch(() => {});
    });
  }
  if (els.mySubmissionsRows) {
    els.mySubmissionsRows.addEventListener("click", onMySubmissionsRowsClicked);
  }
  if (els.reviewQueueRows) {
    els.reviewQueueRows.addEventListener("click", onReviewQueueRowsClicked);
  }

  if (els.solutionReviewChoicePublishedBtn) {
    els.solutionReviewChoicePublishedBtn.addEventListener("click", () => resolveSolutionReviewChoice("published"));
  }
  if (els.solutionReviewChoiceRejectedBtn) {
    els.solutionReviewChoiceRejectedBtn.addEventListener("click", () => resolveSolutionReviewChoice("rejected"));
  }
  if (els.solutionReviewChoiceCancelBtn) {
    els.solutionReviewChoiceCancelBtn.addEventListener("click", () => resolveSolutionReviewChoice("cancel"));
  }

  window.addEventListener("popstate", async () => {
    state.selectedPaths = selectionsFromPathQuery();
    await rebuildFlow({ pushHistory: false, replaceHistory: false });
  });
}

function initializeA11yMessageRegions() {
  const messageRegionIds = [
    "setupMessage",
    "usersCreateMessage",

    "settingsMessage",
    "settingsFlagsMessage",
    "settingsFlagFormMessage",
    "settingsBackupsMessage",
    "settingsBackupRestoreConfirmMessage",
    "loginMessage",
    "topicMessage",
    "answerMessage",
    "renameMessage",
    "moveQuestionMessage",
    "questionMessage",
    "solutionExistingImagesMessage",
    "solutionFlagsMessage",
    "solutionMessage",
    "restoreMessage",
    "mySubmissionsMessage",
    "submissionViewMessage"
  ];

  messageRegionIds.forEach((id) => {
    const region = document.getElementById(id);
    if (!region) {
      return;
    }

    if (!region.hasAttribute("role")) {
      region.setAttribute("role", "status");
    }
    if (!region.hasAttribute("aria-live")) {
      region.setAttribute("aria-live", "polite");
    }
    if (!region.hasAttribute("aria-atomic")) {
      region.setAttribute("aria-atomic", "true");
    }
  });
}

function visibleFocusableElements(container) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }

  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  return Array.from(container.querySelectorAll(selector))
    .filter((el) => el instanceof HTMLElement)
    .filter((el) => !el.hasAttribute("hidden") && !el.closest(".d-none"))
    .filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
}

function activateOverlayFocusTrap(overlayElement, onEscape) {
  if (!(overlayElement instanceof HTMLElement)) {
    return;
  }

  deactivateOverlayFocusTrap(overlayElement, { restoreFocus: false });

  state.overlayFocus.activeElement = overlayElement;
  state.overlayFocus.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  overlayElement.setAttribute("aria-hidden", "false");

  const handler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (typeof onEscape === "function") {
        void onEscape();
      }
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusables = visibleFocusableElements(overlayElement);
    if (!focusables.length) {
      event.preventDefault();
      overlayElement.focus();
      return;
    }

    const currentIndex = focusables.indexOf(document.activeElement);
    const movingBackward = event.shiftKey;

    if (movingBackward) {
      if (currentIndex <= 0) {
        event.preventDefault();
        focusables[focusables.length - 1].focus();
      }
      return;
    }

    if (currentIndex === -1 || currentIndex >= focusables.length - 1) {
      event.preventDefault();
      focusables[0].focus();
    }
  };

  state.overlayFocus.keydownHandler = handler;
  overlayElement.addEventListener("keydown", handler);

  const focusables = visibleFocusableElements(overlayElement);
  if (focusables.length) {
    focusables[0].focus();
  } else {
    overlayElement.focus();
  }
}

function deactivateOverlayFocusTrap(overlayElement, options = {}) {
  if (!(overlayElement instanceof HTMLElement)) {
    return;
  }

  overlayElement.setAttribute("aria-hidden", "true");

  if (state.overlayFocus.activeElement === overlayElement && state.overlayFocus.keydownHandler) {
    overlayElement.removeEventListener("keydown", state.overlayFocus.keydownHandler);
  }

  const restoreFocus = options.restoreFocus !== false;
  const restoreTarget = state.overlayFocus.restoreFocus;

  if (state.overlayFocus.activeElement === overlayElement) {
    state.overlayFocus.activeElement = null;
    state.overlayFocus.keydownHandler = null;
    state.overlayFocus.restoreFocus = null;
  }

  if (restoreFocus && restoreTarget instanceof HTMLElement && document.contains(restoreTarget)) {
    restoreTarget.focus();
  }
}

async function boot() {
  const setupStatus = await apiRequest("/api/setup/status");
  if (!setupStatus.ok || setupStatus.needsSetup) {
    showSetup();
    return;
  }

  showApp();
  await loadBootstrapIconCatalog();
  await refreshAuth();
  if (handleRequiredAuthGate()) {
    return;
  }

  await loadTopics();
  state.selectedPaths = selectionsFromPathQuery();
  await rebuildFlow({ pushHistory: false, replaceHistory: true });
}

async function loadBootstrapIconCatalog() {
  if (state.settings.iconCatalogLoaded) {
    return;
  }

  try {
    const response = await fetch(BOOTSTRAP_ICON_CATALOG_URL, { cache: "force-cache" });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload)) {
        const glyphByClass = {};
        const classes = [];

        payload.forEach((entry) => {
          const iconClass = entry && typeof entry.class === "string" ? entry.class.trim() : "";
          const codepoint = entry && typeof entry.codepoint === "string" ? entry.codepoint.trim().toLowerCase() : "";
          if (!/^bi-[a-z0-9-]+$/.test(iconClass)) {
            return;
          }

          if (!classes.includes(iconClass)) {
            classes.push(iconClass);
          }

          if (/^[a-f0-9]+$/.test(codepoint)) {
            const value = Number.parseInt(codepoint, 16);
            if (Number.isInteger(value) && value > 0 && value <= 0x10ffff) {
              glyphByClass[iconClass] = String.fromCodePoint(value);
            }
          }
        });

        if (classes.length) {
          classes.sort((a, b) => a.localeCompare(b));
          state.settings.allowedIconClasses = classes;
          state.settings.iconGlyphByClass = glyphByClass;
        }
      }
    }
  } catch {
    // Fallback to bundled icon subset when catalog cannot be loaded.
  }

  state.settings.iconCatalogLoaded = true;
}

function showSetup() {
  els.setupSection.classList.remove("d-none");
  els.appSection.classList.add("d-none");
  renderNavActions();
}

function showApp() {
  els.setupSection.classList.add("d-none");
  els.appSection.classList.remove("d-none");
}

async function onSetupSubmit(event) {
  event.preventDefault();
  els.setupMessage.textContent = "";

  const form = new FormData(els.setupForm);
  const payload = {
    username: form.get("username"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword")
  };

  const result = await apiRequest("/api/setup/superadmin", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    els.setupMessage.textContent = result.message || "Unable to create superadmin.";
    return;
  }

  els.setupForm.reset();
  showApp();
  await loadBootstrapIconCatalog();
  await refreshAuth();
  if (handleRequiredAuthGate()) {
    return;
  }

  await loadTopics();
  state.selectedPaths = [];
  await rebuildFlow({ pushHistory: false, replaceHistory: true });
}

async function onLoginSubmit(event) {
  event.preventDefault();
  els.loginMessage.textContent = "";

  const form = new FormData(els.loginForm);
  const payload = {
    username: form.get("username"),
    password: form.get("password"),
    rememberMe: Boolean(form.get("rememberMe"))
  };

  const result = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    els.loginMessage.textContent = result.message || "Login failed.";
    return;
  }

  state.modals.login.hide();
  els.loginForm.reset();
  await refreshAuth();
  if (handleRequiredAuthGate()) {
    return;
  }

  await loadTopics();
  state.selectedPaths = selectionsFromPathQuery();
  await rebuildFlow({ pushHistory: false, replaceHistory: true });
}

async function refreshAuth() {
  const me = await apiRequest("/api/auth/me");
  state.auth = me.ok ? me.user : null;
  state.authMode = me.authMode || state.authMode || "optional";
  await loadUiSettings();
  renderNavActions();
}

function normalizeAutoContrastStrictness(value, fallback = DEFAULT_AUTO_CONTRAST_STRICTNESS) {
  const fallbackNumber = Number.isFinite(Number(fallback)) ? Number(fallback) : DEFAULT_AUTO_CONTRAST_STRICTNESS;
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) ? parsed : fallbackNumber;
  const clamped = Math.min(AUTO_CONTRAST_STRICTNESS_MAX, Math.max(AUTO_CONTRAST_STRICTNESS_MIN, candidate));
  return Math.round(clamped * 10) / 10;
}

function normalizeTreeColor(value, fallback) {
  const source = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(source)) {
    return source;
  }
  const fallbackColor = String(fallback || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(fallbackColor)) {
    return fallbackColor;
  }
  return DEFAULT_TREE_QUESTION_COLOR;
}

function normalizeTreeFontWeight(value, fallback = DEFAULT_TREE_QUESTION_FONT_WEIGHT) {
  const candidate = String(value || "").trim();
  if (TREE_FONT_WEIGHT_OPTIONS.includes(candidate)) {
    return candidate;
  }
  const fallbackValue = String(fallback || "").trim();
  return TREE_FONT_WEIGHT_OPTIONS.includes(fallbackValue) ? fallbackValue : DEFAULT_TREE_QUESTION_FONT_WEIGHT;
}

function defaultTreeHighlightColorForTheme(themeInput = state.theme) {
  const normalizedTheme = normalizeThemeMode(themeInput, state.theme || "light");
  if (normalizedTheme === "dim") {
    return "#161a1f";
  }
  if (normalizedTheme === "dark") {
    return "#000000";
  }
  if (normalizedTheme === "black") {
    return "#101010";
  }
  return DEFAULT_TREE_HIGHLIGHT_COLOR_LIGHT;
}

function normalizeTreeHighlightColor(value, fallback = "") {
  const candidate = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(candidate)) {
    return candidate;
  }
  const fallbackColor = String(fallback || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(fallbackColor)) {
    return fallbackColor;
  }
  return "";
}

function normalizeTreeFontStyle(value, fallback = DEFAULT_TREE_QUESTION_FONT_STYLE) {
  const candidate = String(value || "").trim().toLowerCase();
  if (TREE_FONT_STYLE_OPTIONS.includes(candidate)) {
    return candidate;
  }
  const fallbackValue = String(fallback || "").trim().toLowerCase();
  return TREE_FONT_STYLE_OPTIONS.includes(fallbackValue) ? fallbackValue : DEFAULT_TREE_QUESTION_FONT_STYLE;
}
function normalizeTreeFontSizePx(value, fallback = DEFAULT_TREE_QUESTION_SIZE_PX) {
  const fallbackNumber = Number.isFinite(Number(fallback)) ? Number(fallback) : DEFAULT_TREE_QUESTION_SIZE_PX;
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) ? parsed : fallbackNumber;
  const clamped = Math.min(TREE_FONT_SIZE_MAX, Math.max(TREE_FONT_SIZE_MIN, candidate));
  return Math.round(clamped);
}

function normalizeTreeUnderline(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return Boolean(fallback);
}

function currentAutoContrastStrictness() {
  return normalizeAutoContrastStrictness(state.uiSettings.autoContrastStrictness, DEFAULT_AUTO_CONTRAST_STRICTNESS);
}

function applyTreeAppearanceSettings() {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  root.style.setProperty("--kbn-tree-question-color", normalizeTreeColor(state.uiSettings.treeQuestionColor, DEFAULT_TREE_QUESTION_COLOR));
  root.style.setProperty("--kbn-tree-solution-color", normalizeTreeColor(state.uiSettings.treeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR));
  root.style.setProperty("--kbn-tree-question-font-size", String(normalizeTreeFontSizePx(state.uiSettings.treeQuestionSizePx, DEFAULT_TREE_QUESTION_SIZE_PX)) + "px");
  root.style.setProperty("--kbn-tree-solution-font-size", String(normalizeTreeFontSizePx(state.uiSettings.treeSolutionSizePx, DEFAULT_TREE_SOLUTION_SIZE_PX)) + "px");
  root.style.setProperty("--kbn-tree-question-font-weight", normalizeTreeFontWeight(state.uiSettings.treeQuestionFontWeight, DEFAULT_TREE_QUESTION_FONT_WEIGHT));
  root.style.setProperty("--kbn-tree-question-font-style", normalizeTreeFontStyle(state.uiSettings.treeQuestionFontStyle, DEFAULT_TREE_QUESTION_FONT_STYLE));
  root.style.setProperty("--kbn-tree-question-text-decoration", normalizeTreeUnderline(state.uiSettings.treeQuestionUnderline, DEFAULT_TREE_QUESTION_UNDERLINE) ? "underline" : "none");
  root.style.setProperty("--kbn-tree-solution-font-weight", normalizeTreeFontWeight(state.uiSettings.treeSolutionFontWeight, DEFAULT_TREE_SOLUTION_FONT_WEIGHT));
  root.style.setProperty("--kbn-tree-solution-font-style", normalizeTreeFontStyle(state.uiSettings.treeSolutionFontStyle, DEFAULT_TREE_SOLUTION_FONT_STYLE));
  root.style.setProperty("--kbn-tree-solution-text-decoration", normalizeTreeUnderline(state.uiSettings.treeSolutionUnderline, DEFAULT_TREE_SOLUTION_UNDERLINE) ? "underline" : "none");
  root.style.setProperty("--kbn-tree-question-text-color", normalizeTreeColor(state.uiSettings.treeQuestionTextColor, DEFAULT_TREE_QUESTION_TEXT_COLOR));
  root.style.setProperty("--kbn-tree-question-text-font-size", String(normalizeTreeFontSizePx(state.uiSettings.treeQuestionTextSizePx, DEFAULT_TREE_QUESTION_TEXT_SIZE_PX)) + "px");
  root.style.setProperty("--kbn-tree-question-text-font-weight", normalizeTreeFontWeight(state.uiSettings.treeQuestionTextFontWeight, DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT));
  root.style.setProperty("--kbn-tree-question-text-font-style", normalizeTreeFontStyle(state.uiSettings.treeQuestionTextFontStyle, DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE));
  root.style.setProperty("--kbn-tree-question-text-text-decoration", normalizeTreeUnderline(state.uiSettings.treeQuestionTextUnderline, DEFAULT_TREE_QUESTION_TEXT_UNDERLINE) ? "underline" : "none");

  const highlightColor = normalizeTreeHighlightColor(state.uiSettings.treeHighlightColor, "");
  if (highlightColor) {
    root.style.setProperty("--kbn-tree-active-bg", highlightColor);
    root.style.setProperty("--kbn-tree-active-shadow", "none");
  } else {
    root.style.removeProperty("--kbn-tree-active-bg");
    root.style.removeProperty("--kbn-tree-active-shadow");
  }
}

function applyLocalUiSettingOverrides() {
  try {
    const storedEnabled = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.autoContrastFlagBackground);
    if (storedEnabled === "true" || storedEnabled === "false") {
      state.uiSettings.autoContrastFlagBackground = storedEnabled === "true";
    }

    const storedStrictness = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.autoContrastStrictness);
    if (storedStrictness !== null) {
      state.uiSettings.autoContrastStrictness = normalizeAutoContrastStrictness(
        storedStrictness,
        currentAutoContrastStrictness()
      );
    }

    const storedTreeQuestionColor = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeQuestionColor);
    if (storedTreeQuestionColor !== null) {
      state.uiSettings.treeQuestionColor = normalizeTreeColor(storedTreeQuestionColor, DEFAULT_TREE_QUESTION_COLOR);
    }

    const storedTreeSolutionColor = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeSolutionColor);
    if (storedTreeSolutionColor !== null) {
      state.uiSettings.treeSolutionColor = normalizeTreeColor(storedTreeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR);
    }

    const storedTreeHighlightColor = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeHighlightColor);
    if (storedTreeHighlightColor !== null) {
      state.uiSettings.treeHighlightColor = normalizeTreeHighlightColor(storedTreeHighlightColor, "");
    }

    const storedQuestionWeight = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeQuestionFontWeight)
      || window.localStorage.getItem("kbn.ui.treeFontWeight");
    if (storedQuestionWeight !== null) {
      state.uiSettings.treeQuestionFontWeight = normalizeTreeFontWeight(storedQuestionWeight, DEFAULT_TREE_QUESTION_FONT_WEIGHT);
    }

    const storedQuestionStyle = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeQuestionFontStyle)
      || window.localStorage.getItem("kbn.ui.treeFontStyle");
    if (storedQuestionStyle !== null) {
      state.uiSettings.treeQuestionFontStyle = normalizeTreeFontStyle(storedQuestionStyle, DEFAULT_TREE_QUESTION_FONT_STYLE);
    }

    const storedSolutionWeight = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeSolutionFontWeight)
      || window.localStorage.getItem("kbn.ui.treeFontWeight");
    if (storedSolutionWeight !== null) {
      state.uiSettings.treeSolutionFontWeight = normalizeTreeFontWeight(storedSolutionWeight, DEFAULT_TREE_SOLUTION_FONT_WEIGHT);
    }

    const storedSolutionStyle = window.localStorage.getItem(UI_SETTING_STORAGE_KEYS.treeSolutionFontStyle)
      || window.localStorage.getItem("kbn.ui.treeFontStyle");
    if (storedSolutionStyle !== null) {
      state.uiSettings.treeSolutionFontStyle = normalizeTreeFontStyle(storedSolutionStyle, DEFAULT_TREE_SOLUTION_FONT_STYLE);
    }
  } catch {
    // Ignore storage read errors.
  }
}

function persistLocalUiSettings() {
  try {
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.autoContrastFlagBackground,
      String(Boolean(state.uiSettings.autoContrastFlagBackground))
    );
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.autoContrastStrictness,
      String(currentAutoContrastStrictness())
    );
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.treeQuestionColor,
      normalizeTreeColor(state.uiSettings.treeQuestionColor, DEFAULT_TREE_QUESTION_COLOR)
    );
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.treeSolutionColor,
      normalizeTreeColor(state.uiSettings.treeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR)
    );

    const normalizedHighlightColor = normalizeTreeHighlightColor(state.uiSettings.treeHighlightColor, "");
    if (normalizedHighlightColor) {
      window.localStorage.setItem(UI_SETTING_STORAGE_KEYS.treeHighlightColor, normalizedHighlightColor);
    } else {
      window.localStorage.removeItem(UI_SETTING_STORAGE_KEYS.treeHighlightColor);
    }

    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.treeQuestionFontWeight,
      normalizeTreeFontWeight(state.uiSettings.treeQuestionFontWeight, DEFAULT_TREE_QUESTION_FONT_WEIGHT)
    );
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.treeQuestionFontStyle,
      normalizeTreeFontStyle(state.uiSettings.treeQuestionFontStyle, DEFAULT_TREE_QUESTION_FONT_STYLE)
    );
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.treeSolutionFontWeight,
      normalizeTreeFontWeight(state.uiSettings.treeSolutionFontWeight, DEFAULT_TREE_SOLUTION_FONT_WEIGHT)
    );
    window.localStorage.setItem(
      UI_SETTING_STORAGE_KEYS.treeSolutionFontStyle,
      normalizeTreeFontStyle(state.uiSettings.treeSolutionFontStyle, DEFAULT_TREE_SOLUTION_FONT_STYLE)
    );
  } catch {
    // Ignore storage write errors.
  }
}

async function loadUiSettings() {
  const result = await apiRequest("/api/ui/settings");
  const currentEnabled = Boolean(state.uiSettings.autoContrastFlagBackground);
  const currentStrictness = currentAutoContrastStrictness();

  if (result.ok && result.uiSettings && typeof result.uiSettings === "object") {
    if (typeof result.uiSettings.autoContrastFlagBackground === "boolean") {
      state.uiSettings.autoContrastFlagBackground = result.uiSettings.autoContrastFlagBackground;
    } else {
      state.uiSettings.autoContrastFlagBackground = currentEnabled;
    }

    state.uiSettings.autoContrastStrictness = normalizeAutoContrastStrictness(
      result.uiSettings.autoContrastStrictness,
      currentStrictness
    );
  } else {
    state.uiSettings.autoContrastFlagBackground = currentEnabled;
    state.uiSettings.autoContrastStrictness = currentStrictness;
  }

  const role = state.auth && state.auth.role ? String(state.auth.role) : "user";
  const displayResult = await apiRequest("/api/ui/preferences/display");
  const canManageTree = typeof (displayResult && displayResult.canManageTree) === "boolean"
    ? Boolean(displayResult.canManageTree)
    : role === "admin" || role === "superadmin";
  const display = displayResult && displayResult.ok && displayResult.display && typeof displayResult.display === "object"
    ? displayResult.display
    : {};

  state.theme = normalizeThemeMode(display.theme, "light");

  if (canManageTree) {
    state.uiSettings.treeQuestionColor = normalizeTreeColor(display.treeQuestionColor, DEFAULT_TREE_QUESTION_COLOR);
    state.uiSettings.treeQuestionSizePx = normalizeTreeFontSizePx(display.treeQuestionSizePx, DEFAULT_TREE_QUESTION_SIZE_PX);
    state.uiSettings.treeQuestionFontWeight = normalizeTreeFontWeight(
      normalizeTreeUnderline(display.treeQuestionBold, DEFAULT_TREE_QUESTION_FONT_WEIGHT === "700") ? "700" : "400",
      DEFAULT_TREE_QUESTION_FONT_WEIGHT
    );
    state.uiSettings.treeQuestionFontStyle = normalizeTreeFontStyle(
      normalizeTreeUnderline(display.treeQuestionItalic, DEFAULT_TREE_QUESTION_FONT_STYLE === "italic") ? "italic" : "normal",
      DEFAULT_TREE_QUESTION_FONT_STYLE
    );
    state.uiSettings.treeQuestionUnderline = normalizeTreeUnderline(display.treeQuestionUnderline, DEFAULT_TREE_QUESTION_UNDERLINE);

    state.uiSettings.treeSolutionColor = normalizeTreeColor(display.treeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR);
    state.uiSettings.treeSolutionSizePx = normalizeTreeFontSizePx(display.treeSolutionSizePx, DEFAULT_TREE_SOLUTION_SIZE_PX);
    state.uiSettings.treeSolutionFontWeight = normalizeTreeFontWeight(
      normalizeTreeUnderline(display.treeSolutionBold, DEFAULT_TREE_SOLUTION_FONT_WEIGHT === "700") ? "700" : "400",
      DEFAULT_TREE_SOLUTION_FONT_WEIGHT
    );
    state.uiSettings.treeSolutionFontStyle = normalizeTreeFontStyle(
      normalizeTreeUnderline(display.treeSolutionItalic, DEFAULT_TREE_SOLUTION_FONT_STYLE === "italic") ? "italic" : "normal",
      DEFAULT_TREE_SOLUTION_FONT_STYLE
    );
    state.uiSettings.treeSolutionUnderline = normalizeTreeUnderline(display.treeSolutionUnderline, DEFAULT_TREE_SOLUTION_UNDERLINE);

    state.uiSettings.showQuestionTextInTree = normalizeTreeUnderline(display.showQuestionTextInTree, DEFAULT_SHOW_QUESTION_TEXT_IN_TREE);
    state.uiSettings.treeQuestionTextColor = normalizeTreeColor(display.treeQuestionTextColor, DEFAULT_TREE_QUESTION_TEXT_COLOR);
    state.uiSettings.treeQuestionTextSizePx = normalizeTreeFontSizePx(display.treeQuestionTextSizePx, DEFAULT_TREE_QUESTION_TEXT_SIZE_PX);
    state.uiSettings.treeQuestionTextFontWeight = normalizeTreeFontWeight(
      normalizeTreeUnderline(display.treeQuestionTextBold, DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT === "700") ? "700" : "400",
      DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT
    );
    state.uiSettings.treeQuestionTextFontStyle = normalizeTreeFontStyle(
      normalizeTreeUnderline(display.treeQuestionTextItalic, DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE === "italic") ? "italic" : "normal",
      DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE
    );
    state.uiSettings.treeQuestionTextUnderline = normalizeTreeUnderline(
      display.treeQuestionTextUnderline,
      DEFAULT_TREE_QUESTION_TEXT_UNDERLINE
    );
    state.uiSettings.treeHighlightColor = normalizeTreeHighlightColor(display.treeHighlightColor, "");
  }

  applyTheme(state.theme, { persist: true });
  syncAutoContrastControls();
  applyTreeAppearanceSettings();
}

function normalizeThemeMode(themeValue, fallback = "light") {
  const candidate = String(themeValue || "").trim().toLowerCase();
  if (THEME_MODES.includes(candidate)) {
    return candidate;
  }
  return THEME_MODES.includes(fallback) ? fallback : "light";
}

function initializeTheme() {
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  let theme = prefersDark ? "dark" : "light";

  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    theme = normalizeThemeMode(saved, theme);
  } catch {
    // Ignore storage read errors.
  }

  applyTheme(theme, { persist: false });
}

function applyTheme(theme, { persist = true } = {}) {
  const nextTheme = normalizeThemeMode(theme, state.theme || "light");
  state.theme = nextTheme;

  document.documentElement.setAttribute(
    "data-bs-theme",
    THEME_BOOTSTRAP_MODE[nextTheme] || "light"
  );
  document.documentElement.setAttribute("data-kbn-theme", nextTheme);

  if (!persist) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage write errors.
  }
}

async function openSettingsModal() {
  await loadBootstrapIconCatalog();
  els.settingsMessage.className = "small text-danger";
  els.settingsMessage.textContent = "";
  els.settingsForm.reset();

  if (els.settingsFlagsMessage) {
    els.settingsFlagsMessage.className = "small text-danger";
    els.settingsFlagsMessage.textContent = "";
  }

  if (state.modals.flagEditor) {
    state.modals.flagEditor.hide();
  }

  ensureSettingsFlagColorInput();
  ensureSettingsFlagBackgroundInput();
  resetSettingsFlagEditor();
  syncAutoContrastControls();

  const role = state.auth && state.auth.role ? String(state.auth.role) : "";
  const adminOrSuperadmin = role === "admin" || role === "superadmin";
  const superadmin = role === "superadmin";

  if (els.settingsTreeAppearanceSection) {
    els.settingsTreeAppearanceSection.classList.toggle("d-none", !adminOrSuperadmin);
  }
  if (superadmin && els.settingsFlagsSection) {
    els.settingsFlagsSection.classList.remove("d-none");
    await loadSettingsFlags();
    await loadSettingsAssignableUsers();
    await loadApprovalSettings();
    if (els.settingsFlagEditsRequireApproval) {
      els.settingsFlagEditsRequireApproval.checked = Boolean(state.settings.approvals.flagEditsRequireApproval);
      els.settingsFlagEditsRequireApproval.disabled = false;
    }
    resetSettingsFlagEditor();
    renderSettingsFlagsList();
  } else if (els.settingsFlagsSection) {
    els.settingsFlagsSection.classList.add("d-none");
    if (els.settingsFlagEditsRequireApproval) {
      els.settingsFlagEditsRequireApproval.checked = false;
      els.settingsFlagEditsRequireApproval.disabled = true;
    }
  }

  if (superadmin && els.settingsBackupsSection) {
    els.settingsBackupsSection.classList.remove("d-none");
    setSettingsBackupsMessage("");
    await refreshSettingsBackups(false);
  } else if (els.settingsBackupsSection) {
    els.settingsBackupsSection.classList.add("d-none");
    if (els.settingsBackupsInlineRuntime) {
      els.settingsBackupsInlineRuntime.textContent = "Backups are available to superadmins only.";
    }
    closeSettingsBackupStream();
    if (state.modals.backupManager) {
      state.modals.backupManager.hide();
    }
  }


  if (currentUserCanViewAudit()) {
    await loadAuditSettings();
  } else {
    state.settings.audit.settings = null;
    state.settings.audit.runtime = null;
  }
  syncSettingsAuditControls();
  state.modals.settings.show();
}

function closeSettingsModal() {
  closeSettingsBackupStream();
  if (state.modals.flagEditor) {
    state.modals.flagEditor.hide();
  }
  if (state.modals.backupManager) {
    state.modals.backupManager.hide();
  }
  if (state.modals.backupRestoreConfirm) {
    state.modals.backupRestoreConfirm.hide();
  }
  if (state.modals.audit) {
    state.modals.audit.hide();
  }
  if (state.modals.settings) {
    state.modals.settings.hide();
  }
}

async function openBackupManagerModal() {
  if (!(state.auth && state.auth.role === "superadmin")) {
    return;
  }

  setSettingsBackupsMessage("");
  await refreshSettingsBackups(true);

  if (state.modals.settings) {
    state.modals.settings.hide();
  }
  if (state.modals.backupManager) {
    state.modals.backupManager.show();
  }

  if (state.settings.backups.activeRun && state.settings.backups.activeRun.id) {
    startSettingsBackupStream(state.settings.backups.activeRun.id);
  }
}

async function openCreateFlagEditorModal() {
  await loadSettingsAssignableUsers();
  resetSettingsFlagEditor();
  if (state.modals.flagEditor) {
    state.modals.flagEditor.show();
  }
}

function closeFlagEditorModal() {
  if (state.modals.flagEditor) {
    state.modals.flagEditor.hide();
  }
}

function onFlagEditorModalHidden() {
  resetSettingsFlagEditor();
}

async function onSettingsSubmit(event) {
  event.preventDefault();
  els.settingsMessage.className = "small text-danger";
  els.settingsMessage.textContent = "";

  const form = new FormData(els.settingsForm);
  const oldPassword = String(form.get("oldPassword") || "");
  const newPassword = String(form.get("newPassword") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (!oldPassword && !newPassword && !confirmPassword) {
    showToast("No password changes submitted.", "warning");
    return;
  }

  if (!oldPassword || !newPassword || !confirmPassword) {
    els.settingsMessage.textContent = "Fill all password fields to change password.";
    return;
  }

  if (newPassword !== confirmPassword) {
    els.settingsMessage.textContent = "New password confirmation does not match.";
    return;
  }

  const result = await apiRequest("/api/user/change-password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword })
  });

  if (!result.ok) {
    els.settingsMessage.textContent = result.message || "Unable to change password.";
    return;
  }

  els.settingsMessage.className = "small text-success";
  els.settingsMessage.textContent = "Password changed successfully.";
  showToast("Password changed.", "success");
  els.settingsForm.reset();
}

async function loadApprovalSettings() {
  if (!(state.auth && state.auth.role === "superadmin")) {
    state.settings.approvals.flagEditsRequireApproval = false;
    return;
  }

  const result = await apiRequest("/api/superadmin/approvals/settings");
  if (!result.ok) {
    showToast(result.message || "Unable to load approval settings.", "danger");
    return;
  }

  state.settings.approvals.flagEditsRequireApproval = Boolean(
    result.settings && result.settings.flagEditsRequireApproval
  );
}

async function onSettingsApprovalToggleChanged() {
  if (!(state.auth && state.auth.role === "superadmin")) {
    return;
  }

  if (!els.settingsFlagEditsRequireApproval) {
    return;
  }

  const nextValue = Boolean(els.settingsFlagEditsRequireApproval.checked);
  const previous = Boolean(state.settings.approvals.flagEditsRequireApproval);

  state.settings.approvals.flagEditsRequireApproval = nextValue;

  const result = await apiRequest("/api/superadmin/approvals/settings", {
    method: "POST",
    body: JSON.stringify({ flagEditsRequireApproval: nextValue })
  });

  if (!result.ok) {
    state.settings.approvals.flagEditsRequireApproval = previous;
    els.settingsFlagEditsRequireApproval.checked = previous;
    showToast(result.message || "Unable to save approval settings.", "danger");
    return;
  }

  state.settings.approvals.flagEditsRequireApproval = Boolean(
    result.settings && result.settings.flagEditsRequireApproval
  );
  showToast("Approval setting saved.", "success");
}

function currentUserCanViewAudit() {
  const role = state.auth && state.auth.role ? String(state.auth.role) : "";
  return (role === "admin" || role === "superadmin") && Boolean(state.auth && state.auth.canViewAudit);
}

function setAuditModalMessage(message = "", level = "danger") {
  if (!els.auditModalMessage) {
    return;
  }

  const tone = ["danger", "warning", "success", "secondary"].includes(level) ? level : "danger";
  els.auditModalMessage.className = "small text-" + tone;
  els.auditModalMessage.textContent = String(message || "").trim();
}

function formatAuditSettingsRuntime() {
  const runtime = state.settings.audit.runtime || {};
  const totalRows = Number(runtime.totalRows || 0);
  const oldest = runtime.oldestTimestamp ? formatDateTime(runtime.oldestTimestamp) : "-";
  const newest = runtime.newestTimestamp ? formatDateTime(runtime.newestTimestamp) : "-";

  if (els.settingsAuditRuntime) {
    els.settingsAuditRuntime.innerHTML = "Rows: <strong>" + escapeHtml(String(totalRows))
      + "</strong> | Oldest: " + escapeHtml(oldest)
      + " | Newest: " + escapeHtml(newest);
  }
}

async function loadAuditSettings() {
  if (!currentUserCanViewAudit()) {
    state.settings.audit.settings = null;
    state.settings.audit.runtime = null;
    return;
  }

  const result = await apiRequest("/api/admin/audit/settings");
  if (!result.ok) {
    showToast(result.message || "Unable to load audit settings.", "danger");
    return;
  }

  state.settings.audit.settings = result.settings || null;
  state.settings.audit.runtime = result.runtime || null;
  state.settings.audit.actions = Array.isArray(result.actions) ? result.actions : [];
}

function syncSettingsAuditControls() {
  if (!els.settingsAuditSection) {
    return;
  }

  const canViewAudit = currentUserCanViewAudit();
  els.settingsAuditSection.classList.toggle("d-none", !canViewAudit);
  if (!canViewAudit) {
    return;
  }

  const role = state.auth && state.auth.role ? String(state.auth.role) : "";
  const isSuperadmin = role === "superadmin";
  const settings = state.settings.audit.settings || {};
  const retentionDays = Number(settings.retentionDays || 180);

  if (els.settingsAuditRetentionWrap) {
    els.settingsAuditRetentionWrap.classList.toggle("d-none", !isSuperadmin);
  }
  if (els.settingsAuditRoleNote) {
    els.settingsAuditRoleNote.textContent = isSuperadmin
      ? "Superadmin configurable"
      : "Read-only access";
  }
  if (els.settingsAuditRetentionDays) {
    els.settingsAuditRetentionDays.value = String(retentionDays);
    els.settingsAuditRetentionDays.disabled = !isSuperadmin;
  }

  formatAuditSettingsRuntime();
}

async function onSettingsAuditRetentionChanged() {
  if (!(state.auth && state.auth.role === "superadmin")) {
    return;
  }

  if (!els.settingsAuditRetentionDays) {
    return;
  }

  const previous = Number(state.settings.audit.settings && state.settings.audit.settings.retentionDays
    ? state.settings.audit.settings.retentionDays
    : 180);
  const nextValue = Number.parseInt(String(els.settingsAuditRetentionDays.value || ""), 10);
  if (!Number.isFinite(nextValue) || nextValue < 1 || nextValue > 3650) {
    els.settingsAuditRetentionDays.value = String(previous);
    showToast("Retention days must be between 1 and 3650.", "danger");
    return;
  }

  const result = await apiRequest("/api/superadmin/audit/settings", {
    method: "POST",
    body: JSON.stringify({ retentionDays: nextValue })
  });

  if (!result.ok) {
    els.settingsAuditRetentionDays.value = String(previous);
    showToast(result.message || "Unable to save audit retention.", "danger");
    return;
  }

  state.settings.audit.settings = result.settings || { retentionDays: nextValue };
  state.settings.audit.runtime = result.runtime || state.settings.audit.runtime;
  syncSettingsAuditControls();
  showToast("Audit retention updated.", "success");
}

function onAuditLogModalHidden() {
  setAuditModalMessage("");
}

function syncAuditInputsFromState() {
  const filters = state.settings.audit.filters || {};
  if (els.auditFilterActor) {
    els.auditFilterActor.value = filters.actor || "";
  }
  if (els.auditFilterAction) {
    els.auditFilterAction.value = filters.action || "";
  }
  if (els.auditFilterStatus) {
    els.auditFilterStatus.value = filters.status || "";
  }
  if (els.auditFilterFrom) {
    els.auditFilterFrom.value = filters.from || "";
  }
  if (els.auditFilterTo) {
    els.auditFilterTo.value = filters.to || "";
  }
  if (els.auditFilterQuery) {
    els.auditFilterQuery.value = filters.q || "";
  }
}

function readAuditFiltersFromInputs() {
  state.settings.audit.filters = {
    actor: els.auditFilterActor ? String(els.auditFilterActor.value || "").trim() : "",
    action: els.auditFilterAction ? String(els.auditFilterAction.value || "").trim() : "",
    status: els.auditFilterStatus ? String(els.auditFilterStatus.value || "").trim() : "",
    from: els.auditFilterFrom ? String(els.auditFilterFrom.value || "").trim() : "",
    to: els.auditFilterTo ? String(els.auditFilterTo.value || "").trim() : "",
    q: els.auditFilterQuery ? String(els.auditFilterQuery.value || "").trim() : ""
  };
}

function resetAuditFilters() {
  state.settings.audit.filters = {
    actor: "",
    action: "",
    status: "",
    from: "",
    to: "",
    q: ""
  };
  syncAuditInputsFromState();
}

function buildAuditQuery(pageInput, limitInput) {
  const filters = state.settings.audit.filters || {};
  const params = new URLSearchParams();
  if (filters.actor) {
    params.set("actor", filters.actor);
  }
  if (filters.action) {
    params.set("action", filters.action);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (Number.isFinite(pageInput)) {
    params.set("page", String(pageInput));
  }
  if (Number.isFinite(limitInput)) {
    params.set("limit", String(limitInput));
  }

  return params.toString();
}

function formatAuditStatusBadge(statusInput) {
  const status = String(statusInput || "").trim().toLowerCase();
  const className = status === "success"
    ? "text-bg-success"
    : status === "failure"
      ? "text-bg-danger"
      : status === "denied"
        ? "text-bg-warning"
        : "text-bg-secondary";

  return '<span class="badge ' + className + '">' + escapeHtml(status || "unknown") + '</span>';
}

function renderAuditRows() {
  if (!els.auditRows) {
    return;
  }

  const rows = Array.isArray(state.settings.audit.rows) ? state.settings.audit.rows : [];
  els.auditRows.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="8" class="small text-secondary">No audit events found for current filters.</td>';
    els.auditRows.append(tr);
  } else {
    rows.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="small text-nowrap">' + escapeHtml(formatDateTime(entry.timestamp)) + '</td>'
        + '<td class="small">' + escapeHtml(entry.actor || "") + '</td>'
        + '<td class="small">' + escapeHtml(entry.role || "") + '</td>'
        + '<td class="small text-break">' + escapeHtml(entry.action || "") + '</td>'
        + '<td class="small text-break">' + escapeHtml(entry.target || "-") + '</td>'
        + '<td>' + formatAuditStatusBadge(entry.status) + '</td>'
        + '<td class="small text-break">' + escapeHtml(entry.reason || "-") + '</td>'
        + '<td class="small text-nowrap">' + escapeHtml(entry.ip || "-") + '</td>';
      els.auditRows.append(tr);
    });
  }

  const page = Number(state.settings.audit.page || 1);
  const total = Number(state.settings.audit.total || 0);
  const totalPages = Number(state.settings.audit.totalPages || 1);
  if (els.auditPaginationLabel) {
    const start = total > 0 ? ((page - 1) * state.settings.audit.limit) + 1 : 0;
    const end = total > 0 ? Math.min(total, page * state.settings.audit.limit) : 0;
    els.auditPaginationLabel.textContent = "Showing " + start + "-" + end + " of " + total + " events.";
  }
  if (els.auditSummary) {
    els.auditSummary.textContent = "Page " + page + " of " + totalPages;
  }
  if (els.auditPrevBtn) {
    els.auditPrevBtn.disabled = page <= 1;
  }
  if (els.auditNextBtn) {
    els.auditNextBtn.disabled = page >= totalPages;
  }
}

async function refreshAuditEvents(pageInput = 1) {
  if (!currentUserCanViewAudit()) {
    return;
  }

  readAuditFiltersFromInputs();
  const page = Math.max(1, Number.parseInt(String(pageInput || 1), 10) || 1);
  const limit = Math.max(1, Math.min(500, Number.parseInt(String(state.settings.audit.limit || 100), 10) || 100));
  const query = buildAuditQuery(page, limit);
  const endpoint = query ? "/api/admin/audit/events?" + query : "/api/admin/audit/events";

  const result = await apiRequest(endpoint);
  if (!result.ok) {
    setAuditModalMessage(result.message || "Unable to load audit events.", "danger");
    return;
  }

  setAuditModalMessage("");
  state.settings.audit.rows = Array.isArray(result.rows) ? result.rows : [];
  state.settings.audit.page = Number(result.page || page);
  state.settings.audit.limit = Number(result.limit || limit);
  state.settings.audit.total = Number(result.total || 0);
  state.settings.audit.totalPages = Math.max(1, Number(result.totalPages || 1));
  renderAuditRows();
}

async function exportAuditCsv() {
  if (!currentUserCanViewAudit()) {
    return;
  }

  readAuditFiltersFromInputs();
  const query = buildAuditQuery(null, null);
  const endpoint = query ? "/api/admin/audit/export.csv?" + query : "/api/admin/audit/export.csv";

  const response = await fetch(endpoint, {
    method: "GET",
    credentials: "same-origin"
  });

  if (!response.ok) {
    setAuditModalMessage("Unable to export audit CSV.", "danger");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "audit-events.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function openAuditLogModal() {
  if (!currentUserCanViewAudit()) {
    showToast("Audit log access is not enabled for this account.", "danger");
    return;
  }

  await loadAuditSettings();
  syncSettingsAuditControls();
  syncAuditInputsFromState();

  if (state.modals.settings) {
    state.modals.settings.hide();
  }
  if (state.modals.audit) {
    state.modals.audit.show();
  }

  await refreshAuditEvents(1);
}
function syncCreateApproverControl() {
  if (!els.createRole || !els.createCanApprove || !els.createCanViewAudit) {
    return;
  }

  const role = String(els.createRole.value || "user").trim().toLowerCase();
  if (role === "user") {
    els.createCanApprove.checked = false;
    els.createCanApprove.disabled = true;
    els.createCanViewAudit.checked = false;
    els.createCanViewAudit.disabled = true;
    return;
  }

  if (role === "superadmin") {
    els.createCanApprove.checked = true;
    els.createCanViewAudit.checked = true;
  }

  els.createCanApprove.disabled = false;
  els.createCanViewAudit.disabled = false;
}

function setSettingsBackupsMessage(message = "", level = "danger") {
  if (!els.settingsBackupsMessage) {
    return;
  }

  const tone = ["danger", "warning", "success", "secondary"].includes(level) ? level : "danger";
  els.settingsBackupsMessage.className = `small text-${tone}`;
  els.settingsBackupsMessage.textContent = message || "";
}

function renderSettingsBackupRuntime() {
  const runtime = state.settings.backups.runtime || {};
  const schedulerActive = Boolean(runtime.schedulerActive);
  const nextRunAt = runtime.nextRunAt ? formatDateTime(runtime.nextRunAt) : "-";
  const lastRunAt = runtime.lastRunAt ? formatDateTime(runtime.lastRunAt) : "-";
  const runningJob = runtime.runningJob && runtime.runningJob.id
    ? `${backupRunDisplayName(runtime.runningJob)} (${runtime.runningJob.id})`
    : "None";

  const schedulerClass = schedulerActive ? "text-success" : "text-secondary";
  const schedulerLabel = schedulerActive ? "Enabled" : "Disabled";

  if (els.settingsBackupRuntime) {
    els.settingsBackupRuntime.innerHTML = `
      <div class="d-flex flex-wrap gap-3 small">
        <div>Scheduler: <span class="${schedulerClass}">${schedulerLabel}</span></div>
        <div>Next run: ${escapeHtml(nextRunAt)}</div>
        <div>Last run: ${escapeHtml(lastRunAt)}</div>
        <div>Active job: ${escapeHtml(runningJob)}</div>
      </div>
    `;
  }

  if (els.settingsBackupsInlineRuntime) {
    els.settingsBackupsInlineRuntime.innerHTML = `
      <span>Scheduler: <span class="${schedulerClass}">${schedulerLabel}</span></span>
      <span class="mx-2">|</span>
      <span>Next: ${escapeHtml(nextRunAt)}</span>
      <span class="mx-2">|</span>
      <span>Last: ${escapeHtml(lastRunAt)}</span>
      <span class="mx-2">|</span>
      <span>Active: ${escapeHtml(runningJob)}</span>
    `;
  }
}

function syncSettingsBackupControls() {
  const settings = state.settings.backups.settings;
  if (!settings) {
    renderSettingsBackupRuntime();
    return;
  }

  if (els.settingsBackupScheduleEnabled) {
    els.settingsBackupScheduleEnabled.checked = Boolean(settings.scheduleEnabled);
  }
  if (els.settingsBackupPreset) {
    els.settingsBackupPreset.value = settings.schedulePreset || "daily-02:00";
  }
  if (els.settingsBackupRetentionMode) {
    els.settingsBackupRetentionMode.value = settings.retentionMode || "count+age";
  }
  if (els.settingsBackupKeepLast) {
    els.settingsBackupKeepLast.value = String(settings.keepLast || 14);
  }
  if (els.settingsBackupMaxAgeDays) {
    els.settingsBackupMaxAgeDays.value = String(settings.maxAgeDays || 30);
  }

  syncSettingsBackupRetentionInputs();
  syncSettingsBackupRestoreInputs();
  renderSettingsBackupRuntime();
}

function syncSettingsBackupRetentionInputs() {
  const mode = String(els.settingsBackupRetentionMode ? els.settingsBackupRetentionMode.value : "count+age");
  const showKeepLast = mode === "count-only" || mode === "count+age";
  const showMaxAge = mode === "age-only" || mode === "count+age";

  if (els.settingsBackupKeepLastWrap) {
    els.settingsBackupKeepLastWrap.classList.toggle("d-none", !showKeepLast);
  }
  if (els.settingsBackupMaxAgeDaysWrap) {
    els.settingsBackupMaxAgeDaysWrap.classList.toggle("d-none", !showMaxAge);
  }
}

function syncSettingsBackupRestoreInputs() {
  // Restore form is upload-only in the Restore/History tab.
}
function collectSettingsBackupSettingsPayload() {
  return {
    scheduleEnabled: Boolean(els.settingsBackupScheduleEnabled && els.settingsBackupScheduleEnabled.checked),
    schedulePreset: String(els.settingsBackupPreset ? els.settingsBackupPreset.value : "daily-02:00"),
    retentionMode: String(els.settingsBackupRetentionMode ? els.settingsBackupRetentionMode.value : "count+age"),
    keepLast: Number.parseInt(els.settingsBackupKeepLast ? els.settingsBackupKeepLast.value : "14", 10),
    maxAgeDays: Number.parseInt(els.settingsBackupMaxAgeDays ? els.settingsBackupMaxAgeDays.value : "30", 10),
    includeConfig: true,
    scope: "data+config"
  };
}

async function onSettingsBackupSettingsChanged() {
  if (!(state.auth && state.auth.role === "superadmin")) {
    return;
  }

  syncSettingsBackupRetentionInputs();
  const payload = collectSettingsBackupSettingsPayload();
  const result = await apiRequest("/api/superadmin/backups/settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    setSettingsBackupsMessage(result.message || "Unable to save backup settings.");
    showToast(result.message || "Unable to save backup settings.", "danger");
    await refreshSettingsBackups(false);
    return;
  }

  state.settings.backups.settings = result.settings;
  state.settings.backups.runtime = result.runtime || state.settings.backups.runtime || null;
  state.settings.backups.activeRun = (result.runtime && result.runtime.runningJob) || state.settings.backups.activeRun || null;
  syncSettingsBackupControls();
  setSettingsBackupsMessage("Settings saved.", "success");
  showToast("Backup settings saved.", "success");
}

function onSettingsBackupRetentionModeChanged() {
  syncSettingsBackupRetentionInputs();
  onSettingsBackupSettingsChanged().catch(() => {});
}

async function onSettingsBackupCreateClicked() {
  const label = String(els.settingsBackupLabel ? els.settingsBackupLabel.value : "").trim();
  const result = await apiRequest("/api/superadmin/backups/run", {
    method: "POST",
    body: JSON.stringify({ label })
  });

  if (!result.ok) {
    setSettingsBackupsMessage(result.message || "Unable to start backup run.");
    showToast(result.message || "Unable to start backup run.", "danger");
    return;
  }

  setSettingsBackupsMessage("Backup run started.", "success");
  showToast("Backup run started.", "success");
  await refreshSettingsBackups(false);
  if (result.runId) {
    selectSettingsBackupRun(result.runId);
  }
}

function setSettingsBackupRestoreConfirmMessage(message = "", level = "danger") {
  if (!els.settingsBackupRestoreConfirmMessage) {
    return;
  }

  const tone = ["danger", "warning", "success", "secondary"].includes(level) ? level : "danger";
  els.settingsBackupRestoreConfirmMessage.className = `small text-${tone}`;
  els.settingsBackupRestoreConfirmMessage.textContent = message || "";
}

function onBackupRestoreConfirmModalHidden() {
  setSettingsBackupRestoreConfirmMessage("");
  state.settings.backups.pendingRestoreRequest = null;
  if (els.settingsBackupRestoreConfirmInput) {
    els.settingsBackupRestoreConfirmInput.value = "";
  }
  if (els.settingsBackupRestoreConfirmSummary) {
    els.settingsBackupRestoreConfirmSummary.textContent = "";
  }
}
function activateBackupManagerTab(tabButtonId) {
  const button = document.getElementById(tabButtonId);
  if (!button) {
    return;
  }

  const tab = bootstrap.Tab.getOrCreateInstance(button);
  tab.show();
}

function openSettingsBackupRestoreConfirmModal(requestInput = null) {
  let request = requestInput && typeof requestInput === "object"
    ? { ...requestInput }
    : null;

  if (!request) {
    const file = els.settingsBackupRestoreFile && els.settingsBackupRestoreFile.files && els.settingsBackupRestoreFile.files[0]
      ? els.settingsBackupRestoreFile.files[0]
      : null;

    if (!file) {
      setSettingsBackupsMessage("Choose a ZIP archive to upload before restore.");
      showToast("Choose an archive file first.", "warning");
      return;
    }

    request = {
      sourceType: "upload",
      archiveFile: file,
      label: file.name
    };
  }

  if (request.sourceType === "existing") {
    const archiveId = String(request.archiveId || "").trim();
    if (!archiveId) {
      setSettingsBackupsMessage("Select an existing backup archive before restore.");
      showToast("Select a backup archive first.", "warning");
      return;
    }
    request.archiveId = archiveId;
    request.label = request.label || archiveId;
    if (els.settingsBackupRestoreConfirmSummary) {
      els.settingsBackupRestoreConfirmSummary.textContent = `Source: Existing backup (${request.label})`;
    }
  } else {
    request.sourceType = "upload";
    const file = request.archiveFile || (els.settingsBackupRestoreFile && els.settingsBackupRestoreFile.files && els.settingsBackupRestoreFile.files[0]
      ? els.settingsBackupRestoreFile.files[0]
      : null);
    if (!file) {
      setSettingsBackupsMessage("Choose a ZIP archive to upload before restore.");
      showToast("Choose an archive file first.", "warning");
      return;
    }
    request.archiveFile = file;
    request.label = request.label || file.name;
    if (els.settingsBackupRestoreConfirmSummary) {
      els.settingsBackupRestoreConfirmSummary.textContent = `Source: Upload (${request.label})`;
    }
  }

  state.settings.backups.pendingRestoreRequest = request;
  setSettingsBackupRestoreConfirmMessage("");
  if (els.settingsBackupRestoreConfirmInput) {
    els.settingsBackupRestoreConfirmInput.value = "";
  }

  if (state.modals.backupRestoreConfirm) {
    state.modals.backupRestoreConfirm.show();
  }

  if (els.settingsBackupRestoreConfirmInput) {
    window.setTimeout(() => {
      els.settingsBackupRestoreConfirmInput.focus();
    }, 80);
  }
}
async function onSettingsBackupRestoreClicked() {
  const request = state.settings.backups.pendingRestoreRequest || null;
  const typedConfirm = String(els.settingsBackupRestoreConfirmInput ? els.settingsBackupRestoreConfirmInput.value : "").trim();

  if (typedConfirm.toUpperCase() !== "RESTORE") {
    setSettingsBackupRestoreConfirmMessage("Type RESTORE to confirm restore.");
    return;
  }

  if (!request || !request.sourceType) {
    setSettingsBackupRestoreConfirmMessage("Choose a restore source first.");
    return;
  }

  let result;
  if (els.settingsBackupRestoreConfirmSubmitBtn) {
    els.settingsBackupRestoreConfirmSubmitBtn.disabled = true;
  }

  try {
    if (request.sourceType === "upload") {
      const archiveFile = request.archiveFile || (els.settingsBackupRestoreFile && els.settingsBackupRestoreFile.files && els.settingsBackupRestoreFile.files[0]
        ? els.settingsBackupRestoreFile.files[0]
        : null);

      const formData = new FormData();
      formData.append("sourceType", "upload");
      formData.append("typedConfirm", typedConfirm);
      if (archiveFile) {
        formData.append("archive", archiveFile);
      }

      result = await apiFormRequest("/api/superadmin/backups/restore", formData);
    } else {
      const archiveId = String(request.archiveId || "").trim();
      result = await apiRequest("/api/superadmin/backups/restore", {
        method: "POST",
        body: JSON.stringify({ sourceType: "existing", archiveId, typedConfirm })
      });
    }
  } finally {
    if (els.settingsBackupRestoreConfirmSubmitBtn) {
      els.settingsBackupRestoreConfirmSubmitBtn.disabled = false;
    }
  }

  if (!result.ok) {
    const message = result.message || "Unable to start restore run.";
    setSettingsBackupRestoreConfirmMessage(message);
    setSettingsBackupsMessage(message);
    showToast(message, "danger");
    return;
  }

  if (state.modals.backupRestoreConfirm) {
    state.modals.backupRestoreConfirm.hide();
  }
  state.settings.backups.pendingRestoreRequest = null;
  if (els.settingsBackupRestoreFile) {
    els.settingsBackupRestoreFile.value = "";
  }
  setSettingsBackupsMessage("Restore run started.", "warning");
  showToast("Restore started. Write operations will be paused during apply.", "warning");
  activateBackupManagerTab("backup-manager-history-tab");

  await refreshSettingsBackups(false);
  if (result.runId) {
    selectSettingsBackupRun(result.runId);
  }
}
function onSettingsBackupRunsTableClick(event) {
  const target = event && event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("button[data-backup-action]");
  if (!button) {
    return;
  }

  const action = String(button.getAttribute("data-backup-action") || "");
  const runId = String(button.getAttribute("data-run-id") || "");
  const archiveId = String(button.getAttribute("data-archive-id") || "");

  if (action === "download" && archiveId) {
    window.open(`/api/superadmin/backups/download/${encodeURIComponent(archiveId)}`, "_blank");
    return;
  }

  if (action === "restore" && archiveId) {
    activateBackupManagerTab("backup-manager-history-tab");
    openSettingsBackupRestoreConfirmModal({
      sourceType: "existing",
      archiveId,
      label: backupRunDisplayName((state.settings.backups.runs || []).find((entry) => entry && entry.id === runId) || null)
    });
    return;
  }
  if (action === "delete") {
    const label = runId || archiveId || "this run";
    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    apiRequest(`/api/superadmin/backups/runs/${encodeURIComponent(runId || archiveId)}`, {
      method: "DELETE"
    }).then((result) => {
      if (!result.ok) {
        setSettingsBackupsMessage(result.message || "Unable to delete backup run.");
        showToast(result.message || "Unable to delete backup run.", "danger");
        return;
      }
      showToast("Backup run deleted.", "success");
      refreshSettingsBackups(false).catch(() => {});
    }).catch(() => {
      setSettingsBackupsMessage("Unable to delete backup run.");
    });
  }
}

function selectSettingsBackupRun(runIdInput) {
  const runId = String(runIdInput || "").trim();
  state.settings.backups.selectedRunId = runId;
  const run = (state.settings.backups.runs || []).find((entry) => entry && entry.id === runId) || null;
  state.settings.backups.selectedRun = run;
  renderSettingsBackupRunsTable();
  renderSettingsBackupDetail();
}

function renderSettingsBackupRestoreOptions() {
  // Restore form is upload-only; existing-backup restores are triggered from history actions.
}
function backupRunDisplayName(run) {
  if (!run) {
    return "run";
  }

  if (run.label) {
    return run.label;
  }

  const stamp = formatDateTime(run.createdAt || run.startedAt || "");
  return `${run.type || "backup"} ${stamp}`;
}

function backupRunFileCount(run) {
  if (!run || !run.resultSummary || typeof run.resultSummary !== "object") {
    return "-";
  }

  const summary = run.resultSummary;
  const candidates = [summary.files, summary.extractedEntries];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) {
      return formatNumber(value, 0);
    }
  }

  return "-";
}

function renderSettingsBackupRunsTable() {
  if (!els.settingsBackupRunsBody) {
    return;
  }

  const runs = Array.isArray(state.settings.backups.runs) ? state.settings.backups.runs : [];
  els.settingsBackupRunsBody.innerHTML = "";

  if (!runs.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="7" class="text-secondary">No backup runs yet.</td>';
    els.settingsBackupRunsBody.append(row);
    return;
  }

  runs
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .forEach((run) => {
      const tr = document.createElement("tr");
      const statusClass = run.status === "completed"
        ? "text-success"
        : (run.status === "failed" ? "text-danger" : "text-primary");
      const displayName = backupRunDisplayName(run);
      const archiveId = run.archiveId ? String(run.archiveId) : "";
      const createdAt = formatDateTimeCompact(run.createdAt || run.startedAt || "");
      const filesArchived = backupRunFileCount(run);
      const sizeLabel = run.sizeBytes ? formatFileSize(run.sizeBytes) : "-";
      const typeLabel = String(run.type || "-");
      const triggerLabel = String(run.trigger || "-");

      tr.innerHTML = `
        <td class="kbn-backup-run-cell" data-label="Run">
          <div class="fw-semibold kbn-backup-run-name">${escapeHtml(displayName)}</div>
          <div class="small text-secondary kbn-backup-run-id">${escapeHtml(run.id || "-")}</div>
        </td>
        <td class="small text-capitalize text-nowrap" data-label="Details">${escapeHtml(typeLabel)} | ${escapeHtml(triggerLabel)}</td>
        <td class="small text-nowrap" data-label="Status"><span class="${statusClass}">${escapeHtml(run.status || "-")}</span></td>
        <td class="small text-nowrap" data-label="Created">${escapeHtml(createdAt)}</td>
        <td class="small text-nowrap text-end" data-label="# Files Archived">${escapeHtml(filesArchived)}</td>
        <td class="small text-nowrap text-end" data-label="Size">${escapeHtml(sizeLabel)}</td>
        <td class="text-nowrap text-end" data-label="Actions">
          <div class="d-inline-flex gap-1 kbn-backup-actions" role="group" aria-label="Backup run actions">
            ${archiveId ? `<button type="button" class="btn btn-outline-primary btn-sm" data-backup-action="download" data-run-id="${escapeHtml(run.id)}" data-archive-id="${escapeHtml(archiveId)}" title="Download" aria-label="Download archive"><i class="bi bi-download" aria-hidden="true"></i></button>` : ""}
            ${archiveId ? `<button type="button" class="btn btn-outline-warning btn-sm" data-backup-action="restore" data-run-id="${escapeHtml(run.id)}" data-archive-id="${escapeHtml(archiveId)}" title="Restore" aria-label="Restore archive"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i></button>` : ""}
            <button type="button" class="btn btn-outline-danger btn-sm" data-backup-action="delete" data-run-id="${escapeHtml(run.id)}" data-archive-id="${escapeHtml(archiveId)}" title="Delete" aria-label="Delete run"><i class="bi bi-trash" aria-hidden="true"></i></button>
          </div>
        </td>
      `;

      els.settingsBackupRunsBody.append(tr);
    });
}

function renderSettingsBackupDetail() {
  if (!els.settingsBackupDetail) {
    return;
  }

  const run = state.settings.backups.selectedRun;
  if (!run) {
    els.settingsBackupDetail.textContent = "Select a backup run.";
    return;
  }

  const statusClass = run.status === "completed"
    ? "text-success"
    : (run.status === "failed" ? "text-danger" : "text-primary");
  const source = run.source && run.source.sourceType
    ? `${run.source.sourceType}${run.source.archiveId ? ` (${run.source.archiveId})` : ""}`
    : "-";

  const summaryParts = [];
  if (run.resultSummary && typeof run.resultSummary === "object") {
    if (Number.isFinite(Number(run.resultSummary.files))) {
      summaryParts.push(`${formatNumber(run.resultSummary.files, 0)} files archived`);
    }
    if (Number.isFinite(Number(run.resultSummary.totalBytes))) {
      summaryParts.push(`${formatFileSize(run.resultSummary.totalBytes)} total data`);
    }
    if (Number.isFinite(Number(run.resultSummary.extractedEntries))) {
      summaryParts.push(`${formatNumber(run.resultSummary.extractedEntries, 0)} entries extracted`);
    }
    if (Number.isFinite(Number(run.resultSummary.extractedBytes))) {
      summaryParts.push(`${formatFileSize(run.resultSummary.extractedBytes)} extracted data`);
    }
    if (typeof run.resultSummary.restartPlanned === "boolean") {
      summaryParts.push(run.resultSummary.restartPlanned ? "Restart planned" : "Manual restart may be required");
    }
  }

  const progressMap = state.settings.backups.progressByRun || {};
  const progressEntries = Array.isArray(progressMap[run.id]) ? progressMap[run.id] : [];
  const timeline = progressEntries.length
    ? progressEntries.slice(-8).map((entry) => {
      const stamp = formatTimeOfDay(entry.at || "");
      const text = entry.message || entry.eventType || "progress";
      return `<li><span class="text-secondary">${escapeHtml(stamp)}</span> ${escapeHtml(text)}</li>`;
    }).join("")
    : "";

  const activeRunId = state.settings.backups.activeRun && state.settings.backups.activeRun.id
    ? state.settings.backups.activeRun.id
    : "";
  const liveHint = activeRunId && activeRunId === run.id
    ? '<div class="small text-primary mt-1">Live progress updates are active for this run.</div>'
    : "";

  const fallbackProgress = !timeline && run.progress && run.progress.message
    ? `<div class="small text-secondary mt-2">${escapeHtml(run.progress.message)}</div>`
    : "";

  els.settingsBackupDetail.innerHTML = `
    <div class="fw-semibold mb-1">${escapeHtml(backupRunDisplayName(run))}</div>
    <div>Status: <span class="${statusClass}">${escapeHtml(run.status || "-")}</span></div>
    <div>Type: ${escapeHtml(run.type || "-")} | Trigger: ${escapeHtml(run.trigger || "-")}</div>
    <div>Created: ${escapeHtml(formatDateTime(run.createdAt))}</div>
    <div>Started: ${escapeHtml(formatDateTime(run.startedAt))}</div>
    <div>Ended: ${escapeHtml(formatDateTime(run.endedAt || "In progress"))}</div>
    <div>Archive: ${escapeHtml(run.archiveId || "-")}</div>
    <div>Size: ${escapeHtml(run.sizeBytes ? formatFileSize(run.sizeBytes) : "-")}</div>
    <div>Duration: ${escapeHtml(run.durationMs ? formatDurationMs(run.durationMs) : "-")}</div>
    <div>Source: ${escapeHtml(source)}</div>
    ${run.safetySnapshotRunId ? `<div>Safety snapshot: ${escapeHtml(run.safetySnapshotRunId)}</div>` : ""}
    ${summaryParts.length ? `<div class="small text-secondary mt-1">${escapeHtml(summaryParts.join(" | "))}</div>` : ""}
    ${run.errorMessage ? `<div class="text-danger mt-1">${escapeHtml(run.errorMessage)}</div>` : ""}
    ${liveHint}
    ${timeline ? `<div class="small fw-semibold mt-2">Progress timeline</div><ul class="small mb-0 ps-3">${timeline}</ul>` : fallbackProgress}
  `;
}

function appendSettingsBackupProgressEvent(runIdInput, payload = {}) {
  const runId = String(runIdInput || "").trim();
  if (!runId) {
    return;
  }

  const map = state.settings.backups.progressByRun || {};
  const list = Array.isArray(map[runId]) ? map[runId].slice() : [];
  const message = payload.progress && payload.progress.message
    ? String(payload.progress.message)
    : (payload.errorMessage ? String(payload.errorMessage) : String(payload.status || payload.eventType || "progress"));

  list.push({
    at: payload.at || new Date().toISOString(),
    eventType: String(payload.eventType || "progress"),
    status: String(payload.status || ""),
    message
  });

  if (list.length > 120) {
    list.splice(0, list.length - 120);
  }

  map[runId] = list;
  state.settings.backups.progressByRun = map;
}

function isBackupManagerModalOpen() {
  const modalElement = document.getElementById("backupManagerModal");
  return Boolean(modalElement && modalElement.classList.contains("show"));
}

function closeSettingsBackupStream() {
  const source = state.settings.backups.streamSource;
  if (source) {
    try {
      source.close();
    } catch {
      // no-op
    }
  }
  state.settings.backups.streamSource = null;
  state.settings.backups.streamRunId = "";
}

function startSettingsBackupStream(runIdInput) {
  const runId = String(runIdInput || "").trim();
  if (!runId) {
    closeSettingsBackupStream();
    return;
  }

  if (state.settings.backups.streamRunId === runId && state.settings.backups.streamSource) {
    return;
  }

  closeSettingsBackupStream();

  const source = new EventSource(`/api/superadmin/backups/runs/${encodeURIComponent(runId)}/stream`);
  state.settings.backups.streamSource = source;
  state.settings.backups.streamRunId = runId;

  const applySnapshot = (run) => {
    if (!run || typeof run !== "object") {
      return;
    }
    const runs = Array.isArray(state.settings.backups.runs) ? state.settings.backups.runs : [];
    const idx = runs.findIndex((entry) => entry && entry.id === run.id);
    if (idx >= 0) {
      runs[idx] = run;
    } else {
      runs.unshift(run);
    }
    state.settings.backups.runs = runs;

    if (run.status === "running") {
      state.settings.backups.activeRun = run;
      if (state.settings.backups.runtime && typeof state.settings.backups.runtime === "object") {
        state.settings.backups.runtime.runningJob = run;
      }
    }

    if (Array.isArray(run.progressEvents) && run.progressEvents.length) {
      const map = state.settings.backups.progressByRun || {};
      map[run.id] = run.progressEvents.slice(-120).map((entry) => ({
        at: entry.at || new Date().toISOString(),
        eventType: String(entry.eventType || "progress"),
        status: String(entry.status || ""),
        message: entry.progress && entry.progress.message
          ? String(entry.progress.message)
          : String(entry.message || entry.status || entry.eventType || "progress")
      }));
      state.settings.backups.progressByRun = map;
    }

    if (state.settings.backups.selectedRunId === run.id) {
      state.settings.backups.selectedRun = run;
    }

    renderSettingsBackupRuntime();
    renderSettingsBackupRunsTable();
    renderSettingsBackupDetail();
  };

  source.addEventListener("snapshot", (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data || "{}");
    } catch {
      payload = null;
    }

    if (!payload) {
      return;
    }

    if (payload.run) {
      applySnapshot(payload.run);
      return;
    }

    if (payload.activeRun) {
      applySnapshot(payload.activeRun);
    }
  });

  source.addEventListener("progress", (event) => {
    let payload = null;
    try {
      payload = JSON.parse(event.data || "{}");
    } catch {
      payload = null;
    }

    if (!payload || !payload.runId) {
      return;
    }

    appendSettingsBackupProgressEvent(payload.runId, payload);

    const runs = Array.isArray(state.settings.backups.runs) ? state.settings.backups.runs : [];
    const idx = runs.findIndex((entry) => entry && entry.id === payload.runId);
    if (idx >= 0) {
      const next = { ...runs[idx] };
      if (payload.status) {
        next.status = payload.status;
      }
      if (payload.progress && typeof payload.progress === "object") {
        next.progress = payload.progress;
      }
      if (payload.errorMessage) {
        next.errorMessage = payload.errorMessage;
      }
      runs[idx] = next;

      if (next.status === "running") {
        state.settings.backups.activeRun = next;
      } else if (state.settings.backups.activeRun && state.settings.backups.activeRun.id === next.id) {
        state.settings.backups.activeRun = null;
      }

      if (state.settings.backups.runtime && typeof state.settings.backups.runtime === "object") {
        state.settings.backups.runtime.runningJob = state.settings.backups.activeRun || null;
      }

      if (state.settings.backups.selectedRunId === payload.runId) {
        state.settings.backups.selectedRun = next;
      }
    }

    renderSettingsBackupRuntime();
    renderSettingsBackupRunsTable();
    renderSettingsBackupDetail();
  });

  source.addEventListener("complete", () => {
    if (state.settings.backups.runtime && typeof state.settings.backups.runtime === "object") {
      state.settings.backups.runtime.runningJob = null;
    }
    state.settings.backups.activeRun = null;
    renderSettingsBackupRuntime();
    refreshSettingsBackups(false).catch(() => {});
    closeSettingsBackupStream();
  });

  source.onerror = () => {
    closeSettingsBackupStream();
  };
}

async function refreshSettingsBackups(selectLatest = false) {
  if (!(state.auth && state.auth.role === "superadmin")) {
    return;
  }

  const settingsResult = await apiRequest("/api/superadmin/backups/settings");
  if (!settingsResult.ok) {
    setSettingsBackupsMessage(settingsResult.message || "Unable to load backup settings.");
    return;
  }

  const runsResult = await apiRequest("/api/superadmin/backups/runs?limit=250");
  if (!runsResult.ok) {
    setSettingsBackupsMessage(runsResult.message || "Unable to load backup runs.");
    return;
  }

  state.settings.backups.settings = settingsResult.settings || null;
  state.settings.backups.runtime = settingsResult.runtime || null;
  state.settings.backups.runs = Array.isArray(runsResult.runs) ? runsResult.runs : [];
  state.settings.backups.activeRun = runsResult.activeRun
    || (settingsResult.runtime && settingsResult.runtime.runningJob)
    || null;

  syncSettingsBackupControls();

  const hasSelected = state.settings.backups.selectedRunId
    && state.settings.backups.runs.some((run) => run && run.id === state.settings.backups.selectedRunId);

  if (selectLatest || !hasSelected) {
    const activeRun = state.settings.backups.activeRun;
    if (activeRun && activeRun.id) {
      state.settings.backups.selectedRunId = activeRun.id;
      state.settings.backups.selectedRun = state.settings.backups.runs.find((run) => run && run.id === activeRun.id) || activeRun;
    } else {
      const newest = state.settings.backups.runs
        .slice()
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
      state.settings.backups.selectedRunId = newest ? newest.id : "";
      state.settings.backups.selectedRun = newest;
    }
  } else {
    state.settings.backups.selectedRun = state.settings.backups.runs.find((run) => run && run.id === state.settings.backups.selectedRunId) || null;
  }

  renderSettingsBackupRunsTable();
  renderSettingsBackupDetail();
  setSettingsBackupsMessage("");

  if (isBackupManagerModalOpen() && state.settings.backups.activeRun && state.settings.backups.activeRun.id) {
    startSettingsBackupStream(state.settings.backups.activeRun.id);
  } else {
    closeSettingsBackupStream();
  }
}

function formatFileSize(sizeInput) {
  const size = Number(sizeInput || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${formatNumber(value, index === 0 ? 0 : 2)} ${units[index]}`;
}
function populateTreeFontSizeSelect(selectElement, selectedValue) {
  if (!selectElement) {
    return;
  }

  const normalizedSelected = normalizeTreeFontSizePx(selectedValue, DEFAULT_TREE_QUESTION_SIZE_PX);
  if (!selectElement.options.length) {
    for (let size = TREE_FONT_SIZE_MIN; size <= TREE_FONT_SIZE_MAX; size += 1) {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent = String(size);
      selectElement.append(option);
    }
  }

  selectElement.value = String(normalizedSelected);
}

function setTreeStyleToggleState(button, active) {
  if (!button) {
    return;
  }

  button.classList.toggle("active", Boolean(active));
  button.setAttribute("aria-pressed", Boolean(active) ? "true" : "false");
}

function syncTreeStyleToggleButtons() {
  setTreeStyleToggleState(els.settingsTreeQuestionBold, normalizeTreeFontWeight(state.uiSettings.treeQuestionFontWeight, DEFAULT_TREE_QUESTION_FONT_WEIGHT) >= "700");
  setTreeStyleToggleState(els.settingsTreeQuestionItalic, normalizeTreeFontStyle(state.uiSettings.treeQuestionFontStyle, DEFAULT_TREE_QUESTION_FONT_STYLE) === "italic");
  setTreeStyleToggleState(els.settingsTreeQuestionUnderline, normalizeTreeUnderline(state.uiSettings.treeQuestionUnderline, DEFAULT_TREE_QUESTION_UNDERLINE));

  setTreeStyleToggleState(els.settingsTreeSolutionBold, normalizeTreeFontWeight(state.uiSettings.treeSolutionFontWeight, DEFAULT_TREE_SOLUTION_FONT_WEIGHT) >= "700");
  setTreeStyleToggleState(els.settingsTreeSolutionItalic, normalizeTreeFontStyle(state.uiSettings.treeSolutionFontStyle, DEFAULT_TREE_SOLUTION_FONT_STYLE) === "italic");
  setTreeStyleToggleState(els.settingsTreeSolutionUnderline, normalizeTreeUnderline(state.uiSettings.treeSolutionUnderline, DEFAULT_TREE_SOLUTION_UNDERLINE));

  setTreeStyleToggleState(els.settingsTreeQuestionTextBold, normalizeTreeFontWeight(state.uiSettings.treeQuestionTextFontWeight, DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT) >= "700");
  setTreeStyleToggleState(els.settingsTreeQuestionTextItalic, normalizeTreeFontStyle(state.uiSettings.treeQuestionTextFontStyle, DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE) === "italic");
  setTreeStyleToggleState(els.settingsTreeQuestionTextUnderline, normalizeTreeUnderline(state.uiSettings.treeQuestionTextUnderline, DEFAULT_TREE_QUESTION_TEXT_UNDERLINE));
}

function syncQuestionTextSublineControls() {
  const enabled = Boolean(
    els.settingsShowQuestionTextInTree && els.settingsShowQuestionTextInTree.checked
  );

  if (els.settingsTreeQuestionTextSection) {
    els.settingsTreeQuestionTextSection.classList.toggle("kbn-tree-style-card-disabled", !enabled);
  }

  [
    els.settingsTreeQuestionTextColor,
    els.settingsTreeQuestionTextSize,
    els.settingsTreeQuestionTextBold,
    els.settingsTreeQuestionTextItalic,
    els.settingsTreeQuestionTextUnderline
  ].forEach((el) => {
    if (!el) {
      return;
    }
    el.disabled = !enabled;
  });
}

function syncAutoContrastControls() {
  if (els.settingsAutoContrastFlagBackground) {
    els.settingsAutoContrastFlagBackground.checked = Boolean(state.uiSettings.autoContrastFlagBackground);
  }

  if (els.settingsThemeMode) {
    els.settingsThemeMode.value = normalizeThemeMode(state.theme, "light");
  }

  if (els.settingsShowQuestionTextInTree) {
    els.settingsShowQuestionTextInTree.checked = normalizeTreeUnderline(
      state.uiSettings.showQuestionTextInTree,
      DEFAULT_SHOW_QUESTION_TEXT_IN_TREE
    );
  }

  if (els.settingsTreeQuestionColor) {
    els.settingsTreeQuestionColor.value = normalizeTreeColor(state.uiSettings.treeQuestionColor, DEFAULT_TREE_QUESTION_COLOR);
  }
  if (els.settingsTreeSolutionColor) {
    els.settingsTreeSolutionColor.value = normalizeTreeColor(state.uiSettings.treeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR);
  }
  if (els.settingsTreeQuestionTextColor) {
    els.settingsTreeQuestionTextColor.value = normalizeTreeColor(state.uiSettings.treeQuestionTextColor, DEFAULT_TREE_QUESTION_TEXT_COLOR);
  }

  populateTreeFontSizeSelect(els.settingsTreeQuestionSize, state.uiSettings.treeQuestionSizePx);
  populateTreeFontSizeSelect(els.settingsTreeSolutionSize, state.uiSettings.treeSolutionSizePx);
  populateTreeFontSizeSelect(els.settingsTreeQuestionTextSize, state.uiSettings.treeQuestionTextSizePx);

  if (els.settingsTreeHighlightColor) {
    els.settingsTreeHighlightColor.value = normalizeTreeHighlightColor(
      state.uiSettings.treeHighlightColor,
      defaultTreeHighlightColorForTheme(state.theme)
    );
  }

  syncTreeStyleToggleButtons();
  syncQuestionTextSublineControls();

  if (els.settingsAutoContrastStrictness) {
    els.settingsAutoContrastStrictness.min = String(AUTO_CONTRAST_STRICTNESS_MIN);
    els.settingsAutoContrastStrictness.max = String(AUTO_CONTRAST_STRICTNESS_MAX);
    els.settingsAutoContrastStrictness.step = String(AUTO_CONTRAST_STRICTNESS_STEP);
    els.settingsAutoContrastStrictness.value = String(currentAutoContrastStrictness());
  }

  syncDisplaySettingsLayout();
  syncSettingsFlagBackgroundInputState();
}

function syncDisplaySettingsLayout() {
  if (!els.settingsAutoContrastStrictnessWrap) {
    return;
  }

  const autoContrastEnabled = Boolean(
    els.settingsAutoContrastFlagBackground && els.settingsAutoContrastFlagBackground.checked
  );
  els.settingsAutoContrastStrictnessWrap.classList.toggle("d-none", !autoContrastEnabled);
}

function refreshFlagDependentRender() {
  renderSteps();
  renderSolution();

  if (els.settingsFlagsSection && !els.settingsFlagsSection.classList.contains("d-none")) {
    renderSettingsFlagPreview();
    renderSettingsFlagsList();
  }

  if (state.admin.open && state.admin.selected && state.admin.selected.scope === "kb" && state.admin.selected.type === "terminal") {
    renderAdminSelection().catch(() => {});
  }
}

async function onSettingsAutoContrastToggled() {
  const previous = Boolean(state.uiSettings.autoContrastFlagBackground);
  const enabled = Boolean(els.settingsAutoContrastFlagBackground && els.settingsAutoContrastFlagBackground.checked);
  syncDisplaySettingsLayout();
  state.uiSettings.autoContrastFlagBackground = enabled;
  syncSettingsFlagBackgroundInputState();
  state.uiSettings.autoContrastFlagBackground = previous;
  if (enabled === previous) {
    return;
  }

  const canPersistGlobal = Boolean(state.auth && state.auth.role === "superadmin");
  if (!canPersistGlobal) {
    state.uiSettings.autoContrastFlagBackground = enabled;
    persistLocalUiSettings();
    syncAutoContrastControls();
    showToast("Display setting saved.", "success");
    refreshFlagDependentRender();
    return;
  }

  const result = await apiRequest("/api/superadmin/flags/settings", {
    method: "POST",
    body: JSON.stringify({ autoContrastFlagBackground: enabled })
  });

  if (!result.ok) {
    state.uiSettings.autoContrastFlagBackground = previous;
    persistLocalUiSettings();
    syncAutoContrastControls();
    showToast(result.message || "Unable to save display setting.", "danger");
    return;
  }

  if (result.uiSettings && typeof result.uiSettings === "object") {
    if (typeof result.uiSettings.autoContrastFlagBackground === "boolean") {
      state.uiSettings.autoContrastFlagBackground = result.uiSettings.autoContrastFlagBackground;
    } else {
      state.uiSettings.autoContrastFlagBackground = enabled;
    }

    state.uiSettings.autoContrastStrictness = normalizeAutoContrastStrictness(
      result.uiSettings.autoContrastStrictness,
      currentAutoContrastStrictness()
    );
  } else {
    state.uiSettings.autoContrastFlagBackground = enabled;
  }

  persistLocalUiSettings();
  syncAutoContrastControls();
  showToast("Display setting saved.", "success");
  refreshFlagDependentRender();
}

async function onSettingsAutoContrastStrictnessChanged() {
  const previous = currentAutoContrastStrictness();
  const requested = normalizeAutoContrastStrictness(
    els.settingsAutoContrastStrictness ? els.settingsAutoContrastStrictness.value : previous,
    previous
  );

  if (requested === previous) {
    return;
  }

  const canPersistGlobal = Boolean(state.auth && state.auth.role === "superadmin");
  if (!canPersistGlobal) {
    state.uiSettings.autoContrastStrictness = requested;
    persistLocalUiSettings();
    syncAutoContrastControls();
    showToast("Display setting saved.", "success");
    refreshFlagDependentRender();
    return;
  }

  const result = await apiRequest("/api/superadmin/flags/settings", {
    method: "POST",
    body: JSON.stringify({ autoContrastStrictness: requested })
  });

  if (!result.ok) {
    state.uiSettings.autoContrastStrictness = previous;
    persistLocalUiSettings();
    syncAutoContrastControls();
    showToast(result.message || "Unable to save display setting.", "danger");
    return;
  }

  if (result.uiSettings && typeof result.uiSettings === "object") {
    state.uiSettings.autoContrastStrictness = normalizeAutoContrastStrictness(
      result.uiSettings.autoContrastStrictness,
      requested
    );

    if (typeof result.uiSettings.autoContrastFlagBackground === "boolean") {
      state.uiSettings.autoContrastFlagBackground = result.uiSettings.autoContrastFlagBackground;
    }
  } else {
    state.uiSettings.autoContrastStrictness = requested;
  }

  persistLocalUiSettings();
  syncAutoContrastControls();
  showToast("Display setting saved.", "success");
  refreshFlagDependentRender();
}

function ensureSettingsFlagColorInput(colorValue = "") {
  if (!els.settingsFlagColor) {
    return;
  }

  const normalized = normalizeFlagColorClass(colorValue || els.settingsFlagColor.value);
  if (normalized && HEX_COLOR_PATTERN.test(normalized)) {
    els.settingsFlagColor.value = normalized;
    return;
  }

  if (normalized && BOOTSTRAP_TEXT_COLOR_TO_HEX[normalized]) {
    els.settingsFlagColor.value = BOOTSTRAP_TEXT_COLOR_TO_HEX[normalized];
    return;
  }

  els.settingsFlagColor.value = DEFAULT_FLAG_COLOR;
}

function ensureSettingsFlagBackgroundInput(backgroundColor = "") {
  if (!els.settingsFlagBackgroundEnabled || !els.settingsFlagBackgroundColor) {
    return;
  }

  const normalized = normalizeFlagBackgroundColor(backgroundColor);
  const hasCustom = Boolean(normalized);
  els.settingsFlagBackgroundEnabled.checked = hasCustom;
  els.settingsFlagBackgroundColor.value = hasCustom ? normalized : DEFAULT_FLAG_BACKGROUND_COLOR;
  syncSettingsFlagBackgroundInputState();
}

function syncSettingsFlagBackgroundInputState() {
  if (!els.settingsFlagBackgroundEnabled || !els.settingsFlagBackgroundColor) {
    return;
  }

  const autoContrastEnabled = Boolean(state.uiSettings.autoContrastFlagBackground);
  const customBackgroundEnabled = Boolean(els.settingsFlagBackgroundEnabled.checked);

  els.settingsFlagBackgroundEnabled.disabled = autoContrastEnabled;
  els.settingsFlagBackgroundColor.disabled = autoContrastEnabled || !customBackgroundEnabled;

  if (els.settingsFlagBackgroundWrap) {
    els.settingsFlagBackgroundWrap.classList.toggle("opacity-50", autoContrastEnabled);
  }

  const disabledReason = autoContrastEnabled
    ? "Disabled due to Auto Contrast Flag Background setting"
    : "";
  [els.settingsFlagBackgroundWrap, els.settingsFlagBackgroundEnabled, els.settingsFlagBackgroundColor]
    .filter(Boolean)
    .forEach((element) => {
      if (disabledReason) {
        element.title = disabledReason;
        return;
      }
      element.removeAttribute("title");
    });
}

function onSettingsFlagBackgroundEnabledChanged() {
  syncSettingsFlagBackgroundInputState();
  renderSettingsFlagPreview();
}

function setSettingsFlagIcon(iconClass) {
  if (!els.settingsFlagIcon) {
    return;
  }

  els.settingsFlagIcon.value = safeFlagIconClass(iconClass);
  ensureSettingsIconOptions();
  renderSettingsFlagPreview();
}

function ensureSettingsIconOptions() {
  if (!els.settingsFlagIcon || !els.settingsFlagIconGrid) {
    return;
  }

  const icons = Array.isArray(state.settings.allowedIconClasses) && state.settings.allowedIconClasses.length
    ? state.settings.allowedIconClasses
    : [...BOOTSTRAP_ICON_CLASSES];

  let current = safeFlagIconClass(els.settingsFlagIcon.value);
  if (current && !icons.includes(current)) {
    current = "";
    els.settingsFlagIcon.value = "";
  }

  const query = String(els.settingsFlagIconSearch ? els.settingsFlagIconSearch.value : "")
    .trim()
    .toLowerCase();

  const filtered = query
    ? icons.filter((iconClass) => iconClass.toLowerCase().includes(query))
    : icons;

  els.settingsFlagIconGrid.innerHTML = "";

  filtered.forEach((iconClass) => {
    const safeIcon = safeFlagIconClass(iconClass);
    if (!safeIcon) {
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `kbn-icon-btn${safeIcon === current ? " active" : ""}`;
    btn.title = safeIcon;
    btn.setAttribute("aria-label", safeIcon);
    btn.innerHTML = `<i class="bi ${safeIcon}" aria-hidden="true"></i>`;
    btn.addEventListener("click", () => setSettingsFlagIcon(safeIcon));
    els.settingsFlagIconGrid.append(btn);
  });

  if (els.settingsFlagIconCurrent) {
    if (current) {
      els.settingsFlagIconCurrent.classList.remove("text-secondary");
      els.settingsFlagIconCurrent.innerHTML = `<i class="bi ${current}" aria-hidden="true"></i>`;
      els.settingsFlagIconCurrent.setAttribute("title", current);
    } else {
      els.settingsFlagIconCurrent.classList.add("text-secondary");
      els.settingsFlagIconCurrent.innerHTML = '<i class="bi bi-dash" aria-hidden="true"></i>';
      els.settingsFlagIconCurrent.setAttribute("title", "No icon");
    }
  }

  if (els.settingsFlagIconClear) {
    els.settingsFlagIconClear.classList.toggle("active", !current);
  }
}

async function loadSettingsAssignableUsers() {
  if (!state.auth || state.auth.role !== "superadmin") {
    state.users.list = [];
    renderSettingsFlagUsersList([]);
    return;
  }

  const result = await apiRequest("/api/superadmin/users/");
  if (!result.ok) {
    state.users.list = [];
    renderSettingsFlagUsersList([]);
    if (els.settingsFlagsMessage) {
      els.settingsFlagsMessage.textContent = result.message || "Unable to load users for flag restrictions.";
    }
    return;
  }

  state.users.list = Array.isArray(result.users) ? result.users : [];
  renderSettingsFlagUsersList(collectSelectedSettingsFlagUsers());
}

function collectSelectedSettingsFlagUsers() {
  if (!els.settingsFlagUsersList) {
    return [];
  }

  const selected = Array.from(els.settingsFlagUsersList.querySelectorAll("input.kbn-user-select-checkbox:checked"))
    .map((input) => String(input.getAttribute("data-username") || "").trim())
    .filter(Boolean);

  return [...new Set(selected)];
}

function renderSettingsFlagUsersList(selectedUsersInput = []) {
  if (!els.settingsFlagUsersList) {
    return;
  }

  const selectedLookup = new Set(
    (Array.isArray(selectedUsersInput) ? selectedUsersInput : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const users = (Array.isArray(state.users.list) ? state.users.list : [])
    .map((entry) => String(entry && entry.username ? entry.username : "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  els.settingsFlagUsersList.innerHTML = "";

  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary";
    empty.textContent = "No users available.";
    els.settingsFlagUsersList.append(empty);
    return;
  }

  users.forEach((username, index) => {
    const row = document.createElement("div");
    row.className = "form-check";

    const checkboxId = `settings-flag-user-${index}`;
    const normalized = username.toLowerCase();

    row.innerHTML = `<input class="form-check-input kbn-user-select-checkbox" type="checkbox" id="${checkboxId}" data-username="${escapeHtml(username)}" ${selectedLookup.has(normalized) ? "checked" : ""} />
      <label class="form-check-label" for="${checkboxId}">${escapeHtml(username)}</label>`;

    els.settingsFlagUsersList.append(row);
  });
}

function collectSettingsFlagPayload() {
  const restrictionType = String(els.settingsFlagRestrictionType ? els.settingsFlagRestrictionType.value : "none");
  const allowedRoles = [
    els.settingsFlagRoleUser,
    els.settingsFlagRoleAdmin,
    els.settingsFlagRoleSuperadmin
  ]
    .filter(Boolean)
    .filter((box) => box.checked)
    .map((box) => box.value);

  const allowedUsers = collectSelectedSettingsFlagUsers();

  const backgroundEnabled = Boolean(els.settingsFlagBackgroundEnabled && els.settingsFlagBackgroundEnabled.checked);
  const backgroundCandidate = els.settingsFlagBackgroundColor ? els.settingsFlagBackgroundColor.value : DEFAULT_FLAG_BACKGROUND_COLOR;
  const normalizedBackground = normalizeFlagBackgroundColor(backgroundCandidate);

  return {
    name: String(els.settingsFlagName ? els.settingsFlagName.value : "").trim(),
    message: String(els.settingsFlagMessage ? els.settingsFlagMessage.value : "").trim(),
    colorClass: normalizeFlagColorClass(els.settingsFlagColor ? els.settingsFlagColor.value : DEFAULT_FLAG_COLOR) || DEFAULT_FLAG_COLOR,
    backgroundColor: backgroundEnabled ? (normalizedBackground || DEFAULT_FLAG_BACKGROUND_COLOR) : "",
    iconClass: safeFlagIconClass(els.settingsFlagIcon ? els.settingsFlagIcon.value : ""),
    restrictionType,
    allowedRoles,
    allowedUsers
  };
}

function onSettingsFlagRestrictionChanged() {
  const mode = String(els.settingsFlagRestrictionType ? els.settingsFlagRestrictionType.value : "none");
  if (els.settingsFlagRolesWrap) {
    els.settingsFlagRolesWrap.classList.toggle("d-none", mode !== "roles");
  }
  if (els.settingsFlagUsersWrap) {
    els.settingsFlagUsersWrap.classList.toggle("d-none", mode !== "users");
  }

  if (mode === "users" && (!Array.isArray(state.users.list) || !state.users.list.length)) {
    loadSettingsAssignableUsers().catch(() => {});
  }

  renderSettingsFlagPreview();
}

function resetSettingsFlagEditor() {
  state.settings.editingFlagName = null;

  if (els.settingsFlagForm) {
    els.settingsFlagForm.reset();
  }
  if (els.settingsFlagIconSearch) {
    els.settingsFlagIconSearch.value = "";
  }
  if (els.settingsFlagIcon) {
    els.settingsFlagIcon.value = "";
  }

  ensureSettingsFlagColorInput();
  ensureSettingsFlagBackgroundInput("");
  ensureSettingsIconOptions();
  renderSettingsFlagUsersList([]);

  if (els.settingsFlagRestrictionType) {
    els.settingsFlagRestrictionType.value = "none";
  }

  if (els.settingsFlagFormTitle) {
    els.settingsFlagFormTitle.textContent = "Create Flag";
  }
  if (els.settingsFlagSaveBtn) {
    els.settingsFlagSaveBtn.textContent = "Create Flag";
  }
  if (els.settingsFlagCancelBtn) {
    els.settingsFlagCancelBtn.textContent = "Cancel";
  }
  if (els.settingsFlagFormMessage) {
    els.settingsFlagFormMessage.className = "small text-danger";
    els.settingsFlagFormMessage.textContent = "";
  }

  onSettingsFlagRestrictionChanged();
  renderSettingsFlagPreview();
}

function startSettingsFlagEdit(flag) {
  state.settings.editingFlagName = flag.name;

  if (els.settingsFlagName) {
    els.settingsFlagName.value = flag.name;
  }
  if (els.settingsFlagMessage) {
    els.settingsFlagMessage.value = flag.message || "";
  }
  ensureSettingsFlagColorInput(flag.colorClass);
  ensureSettingsFlagBackgroundInput(flag.backgroundColor || "");
  if (els.settingsFlagIconSearch) {
    els.settingsFlagIconSearch.value = "";
  }
  if (els.settingsFlagIcon) {
    els.settingsFlagIcon.value = safeFlagIconClass(flag.iconClass || "") || "";
  }
  ensureSettingsIconOptions();
  if (els.settingsFlagRestrictionType) {
    els.settingsFlagRestrictionType.value = flag.restrictionType || "none";
  }

  if (els.settingsFlagRoleUser) {
    els.settingsFlagRoleUser.checked = Array.isArray(flag.allowedRoles) && flag.allowedRoles.includes("user");
  }
  if (els.settingsFlagRoleAdmin) {
    els.settingsFlagRoleAdmin.checked = Array.isArray(flag.allowedRoles) && flag.allowedRoles.includes("admin");
  }
  if (els.settingsFlagRoleSuperadmin) {
    els.settingsFlagRoleSuperadmin.checked = Array.isArray(flag.allowedRoles) && flag.allowedRoles.includes("superadmin");
  }
  renderSettingsFlagUsersList(Array.isArray(flag.allowedUsers) ? flag.allowedUsers : []);

  if (els.settingsFlagFormTitle) {
    els.settingsFlagFormTitle.textContent = "Edit " + flag.name;
  }
  if (els.settingsFlagSaveBtn) {
    els.settingsFlagSaveBtn.textContent = "Save Flag";
  }
  if (els.settingsFlagCancelBtn) {
    els.settingsFlagCancelBtn.textContent = "Cancel";
  }
  if (els.settingsFlagFormMessage) {
    els.settingsFlagFormMessage.className = "small text-danger";
    els.settingsFlagFormMessage.textContent = "";
  }

  onSettingsFlagRestrictionChanged();
  renderSettingsFlagPreview();

  if (state.modals.flagEditor) {
    state.modals.flagEditor.show();
  }
}

function renderSettingsFlagPreview() {
  if (!els.settingsFlagPreview) {
    return;
  }

  const payload = collectSettingsFlagPayload();
  const name = payload.name || ".flag-name";
  const colorMeta = flagColorMeta(payload.colorClass, "text-secondary", payload.backgroundColor);
  const iconHtml = flagIconHtml(payload.iconClass, "me-1");

  const restrictionLabel = payload.restrictionType === "roles"
    ? `Allowed roles: ${payload.allowedRoles.join(", ") || "(none)"}`
    : payload.restrictionType === "users"
      ? `Allowed users: ${payload.allowedUsers.join(", ") || "(none)"}`
      : "No access restriction";

  const nameHtml = flagTextHtml(escapeHtml(name), colorMeta, "fw-semibold");
  const messageHtml = flagTextHtml(
    `${iconHtml}${escapeHtml(payload.message || "User-facing message preview")}`,
    colorMeta,
    "",
    { fillWidth: true }
  );

  els.settingsFlagPreview.innerHTML = `<div>${nameHtml}</div>
    <div>${messageHtml}</div>
    <div class="text-secondary">${escapeHtml(restrictionLabel)}</div>`;
}

function renderSettingsFlagsList() {
  if (!els.settingsFlagsList) {
    return;
  }

  els.settingsFlagsList.innerHTML = "";
  const flags = Array.isArray(state.settings.flags) ? state.settings.flags : [];
  if (!flags.length) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary";
    empty.textContent = "No flags defined yet.";
    els.settingsFlagsList.append(empty);
    return;
  }

  flags.forEach((flag) => {
    const row = document.createElement("div");
    row.className = "border rounded p-2";

    const colorMeta = flagColorMeta(flag.colorClass, "text-secondary", flag.backgroundColor);
    const restrictionLabel = flag.restrictionType === "roles"
      ? `Roles: ${(flag.allowedRoles || []).join(", ") || "(none)"}`
      : flag.restrictionType === "users"
        ? `Users: ${(flag.allowedUsers || []).join(", ") || "(none)"}`
        : "Restriction: none";
    const iconHtml = flagIconHtml(flag.iconClass, "me-1");
    const nameHtml = flagTextHtml(escapeHtml(flag.name), colorMeta, "fw-semibold");
    const messageHtml = flagTextHtml(`${iconHtml}${escapeHtml(flag.message || "")}`, colorMeta, "small", { fillWidth: true });

    row.innerHTML = `<div class="d-flex justify-content-between align-items-start gap-2">
      <div>
        <div>${nameHtml}</div>
        <div>${messageHtml}</div>
        <div class="small text-secondary">${escapeHtml(restrictionLabel)}</div>
      </div>
      <div class="d-flex gap-1"></div>
    </div>`;

    const actions = row.querySelector(".d-flex.gap-1");
    actions.append(
      buildButton("Edit", "btn-outline-secondary btn-sm", () => startSettingsFlagEdit(flag)),
      buildButton("Delete", "btn-outline-danger btn-sm", async () => {
        const confirmed = window.confirm(`Delete ${flag.name}? Existing assignments will be removed.`);
        if (!confirmed) {
          return;
        }

        const result = await apiRequest("/api/superadmin/flags/delete", {
          method: "POST",
          body: JSON.stringify({ name: flag.name })
        });

        if (!result.ok) {
          if (els.settingsFlagsMessage) {
            els.settingsFlagsMessage.textContent = result.message || "Unable to delete flag.";
          }
          return;
        }

        showToast(`Deleted ${flag.name}.`, "success");
        await loadSettingsFlags();
        renderSettingsFlagsList();
        if (state.settings.editingFlagName === flag.name) {
          resetSettingsFlagEditor();
        }
      })
    );

    els.settingsFlagsList.append(row);
  });
}

async function loadSettingsFlags() {
  const previousAutoContrast = Boolean(state.uiSettings.autoContrastFlagBackground);
  const previousStrictness = currentAutoContrastStrictness();
  const result = await apiRequest("/api/superadmin/flags/");
  if (!result.ok) {
    if (els.settingsFlagsMessage) {
      els.settingsFlagsMessage.textContent = result.message || "Unable to load flag settings.";
    }
    state.settings.flags = [];
    return;
  }

  state.settings.flags = Array.isArray(result.flags) ? result.flags : [];
  if (result.uiSettings && typeof result.uiSettings === "object") {
    if (typeof result.uiSettings.autoContrastFlagBackground === "boolean") {
      state.uiSettings.autoContrastFlagBackground = result.uiSettings.autoContrastFlagBackground;
    }

    state.uiSettings.autoContrastStrictness = normalizeAutoContrastStrictness(
      result.uiSettings.autoContrastStrictness,
      previousStrictness
    );
  }


  syncAutoContrastControls();
  const serverIcons = Array.isArray(result.allowedIconClasses)
    ? result.allowedIconClasses.filter((value) => typeof value === "string" && value.trim())
    : [];
  if (serverIcons.length) {
    state.settings.allowedIconClasses = [...new Set([...state.settings.allowedIconClasses, ...serverIcons])]
      .sort((a, b) => a.localeCompare(b));
  } else if (!state.settings.allowedIconClasses.length) {
    state.settings.allowedIconClasses = [...BOOTSTRAP_ICON_CLASSES];
  }
  state.settings.reservedNames = Array.isArray(result.reservedNames) ? result.reservedNames : [".lock"];

  ensureSettingsFlagColorInput();
  ensureSettingsFlagBackgroundInput();
  ensureSettingsIconOptions();
  if (els.settingsFlagsMessage) {
    els.settingsFlagsMessage.className = "small text-danger";
    els.settingsFlagsMessage.textContent = "";
  }

  if (
    previousAutoContrast !== Boolean(state.uiSettings.autoContrastFlagBackground)
    || previousStrictness !== currentAutoContrastStrictness()
  ) {
    renderSteps();
    renderSolution();
  }
}

async function onSettingsFlagSubmit(event) {
  event.preventDefault();

  if (els.settingsFlagFormMessage) {
    els.settingsFlagFormMessage.className = "small text-danger";
    els.settingsFlagFormMessage.textContent = "";
  }

  const payload = collectSettingsFlagPayload();
  const isEdit = Boolean(state.settings.editingFlagName);
  const endpoint = isEdit ? "/api/superadmin/flags/update" : "/api/superadmin/flags/";
  const body = isEdit
    ? { ...payload, existingName: state.settings.editingFlagName }
    : payload;

  const result = await apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!result.ok) {
    if (els.settingsFlagFormMessage) {
      els.settingsFlagFormMessage.textContent = result.message || "Unable to save flag.";
    }
    return;
  }

  showToast(isEdit ? "Flag updated." : "Flag created.", "success");
  await loadSettingsFlags();
  renderSettingsFlagsList();
  closeFlagEditorModal();
}

function normalizeFlagColorClass(colorClass) {
  const candidate = String(colorClass || "").trim();
  if (!candidate) {
    return "";
  }
  if (HEX_COLOR_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }
  return BOOTSTRAP_TEXT_COLOR_CLASSES.includes(candidate) ? candidate : "";
}

function normalizeFlagBackgroundColor(backgroundColor) {
  const candidate = String(backgroundColor || "").trim();
  if (!candidate) {
    return "";
  }
  if (!HEX_COLOR_PATTERN.test(candidate)) {
    return "";
  }
  return candidate.toLowerCase();
}

function resolveFlagColorHex(normalizedColorClass) {
  if (normalizedColorClass && HEX_COLOR_PATTERN.test(normalizedColorClass)) {
    return normalizedColorClass;
  }

  return String(
    BOOTSTRAP_TEXT_COLOR_TO_HEX[normalizedColorClass]
    || BOOTSTRAP_TEXT_COLOR_TO_HEX["text-secondary"]
    || DEFAULT_FLAG_COLOR
  ).toLowerCase();
}

function activeThemeSurfaceHex() {
  const themeKey = normalizeThemeMode(state.theme, "light");
  return THEME_SURFACE_HEX[themeKey] || THEME_SURFACE_HEX.light;
}

function hexToRgb(hexValue) {
  const normalized = String(hexValue || "").trim().toLowerCase();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return null;
  }

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

function relativeLuminance(rgb) {
  if (!rgb) {
    return 0;
  }

  const linearize = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * linearize(rgb.r)) + (0.7152 * linearize(rgb.g)) + (0.0722 * linearize(rgb.b));
}

function contrastRatioHex(firstHex, secondHex) {
  const first = hexToRgb(firstHex);
  const second = hexToRgb(secondHex);
  if (!first || !second) {
    return 1;
  }

  const firstLum = relativeLuminance(first);
  const secondLum = relativeLuminance(second);
  const lighter = Math.max(firstLum, secondLum);
  const darker = Math.min(firstLum, secondLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickFlagChipBackground(textHex) {
  const themeKey = normalizeThemeMode(state.theme, "light");
  const candidates = THEME_CHIP_BACKGROUNDS[themeKey] || LIGHT_THEME_CHIP_BACKGROUNDS;

  let bestCandidate = candidates[0];
  let bestContrast = 0;

  for (const candidate of candidates) {
    const ratio = contrastRatioHex(textHex, candidate);
    if (ratio > bestContrast) {
      bestContrast = ratio;
      bestCandidate = candidate;
    }
    if (ratio >= currentAutoContrastStrictness()) {
      return candidate;
    }
  }

  const whiteRatio = contrastRatioHex(textHex, "#ffffff");
  const blackRatio = contrastRatioHex(textHex, "#000000");
  return whiteRatio >= blackRatio ? "#ffffff" : "#000000";
}

function flagColorMeta(colorClass, fallbackClass = "text-secondary", backgroundColor = "") {
  const normalized = normalizeFlagColorClass(colorClass);
  const classColor = normalized && !HEX_COLOR_PATTERN.test(normalized) ? normalized : "";
  const inlineColor = normalized && HEX_COLOR_PATTERN.test(normalized) ? normalized : "";
  const className = classColor || (inlineColor ? "" : fallbackClass);
  const colorHex = resolveFlagColorHex(normalized || fallbackClass);
  const baseContrast = contrastRatioHex(colorHex, activeThemeSurfaceHex());
  const manualBackground = normalizeFlagBackgroundColor(backgroundColor);
  const autoContrastEnabled = state.uiSettings.autoContrastFlagBackground !== false;
  const autoBackground = baseContrast < currentAutoContrastStrictness() ? pickFlagChipBackground(colorHex) : "";
  const chipBackground = autoContrastEnabled ? autoBackground : manualBackground;
  const needsChip = Boolean(chipBackground);

  return {
    className,
    styleColor: inlineColor,
    styleAttr: inlineColor ? ` style="color: ${inlineColor};"` : "",
    colorHex,
    needsChip,
    chipBackground
  };
}

function flagTextHtml(contentHtml, colorMeta, extraClass = "", options = {}) {
  const fillWidth = Boolean(options && options.fillWidth);

  const classes = [];
  if (extraClass) {
    classes.push(extraClass);
  }
  if (colorMeta && colorMeta.className) {
    classes.push(colorMeta.className);
  }
  if (colorMeta && colorMeta.needsChip) {
    classes.push("kbn-flag-chip");
    if (fillWidth) {
      classes.push("kbn-flag-chip-fill");
    }
  }

  const styleParts = [];
  if (colorMeta && colorMeta.styleColor) {
    styleParts.push(`color: ${colorMeta.styleColor};`);
  }
  if (colorMeta && colorMeta.needsChip && colorMeta.chipBackground) {
    styleParts.push(`background-color: ${colorMeta.chipBackground};`);
  }

  const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
  const styleAttr = styleParts.length ? ` style="${styleParts.join(" ")}"` : "";
  return `<span${classAttr}${styleAttr}>${contentHtml}</span>`;
}

function safeFlagIconClass(iconClass) {
  const candidate = String(iconClass || "").trim();
  const allowed = Array.isArray(state.settings.allowedIconClasses) && state.settings.allowedIconClasses.length
    ? state.settings.allowedIconClasses
    : BOOTSTRAP_ICON_CLASSES;
  return allowed.includes(candidate) ? candidate : "";
}

function flagIconHtml(iconClass, spacingClass = "me-2") {
  const safeIcon = safeFlagIconClass(iconClass);
  if (!safeIcon) {
    return "";
  }
  const safeSpacing = String(spacingClass || "").trim();
  const spacing = safeSpacing ? `${safeSpacing} ` : "";
  return `<i class="bi ${safeIcon} ${spacing}" aria-hidden="true"></i>`;
}

function optionSelectorFlags(option) {
  if (!option || typeof option !== "object" || !option.terminal) {
    return [];
  }

  const ordered = [];
  const seen = new Set();

  const appendFlag = (flag, blocking = false) => {
    if (!flag || typeof flag !== "object") {
      return;
    }

    const name = typeof flag.name === "string" ? flag.name.trim() : "";
    const message = typeof flag.message === "string" ? flag.message.trim() : "";
    const dedupeKey = name || `${String(flag.iconClass || "").trim()}|${String(flag.colorClass || "").trim()}|${String(flag.backgroundColor || "").trim()}|${message}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    const fallbackIcon = safeFlagIconClass("bi-flag");
    const iconClass = safeFlagIconClass(flag.iconClass) || fallbackIcon;
    if (!iconClass) {
      return;
    }

    ordered.push({
      name: name || "Flag",
      message,
      colorClass: normalizeFlagColorClass(flag.colorClass),
      backgroundColor: normalizeFlagBackgroundColor(flag.backgroundColor),
      iconClass,
      blocking: Boolean(blocking)
    });
  };

  if (option.restricted && option.blockingFlag) {
    appendFlag(option.blockingFlag, true);
  }

  const flags = Array.isArray(option.flags) ? option.flags : [];
  for (const flag of flags) {
    appendFlag(flag, false);
  }

  return ordered;
}

function handleRequiredAuthGate() {
  if (state.authMode !== "required" || state.auth) {
    return false;
  }

  state.topics = [];
  state.selectedPaths = [];
  state.steps = [{ question: "Login required", options: [], selectedPath: null }];
  state.landing.dismissed = false;
  resetSearchState();
  state.terminal = null;
  renderSteps();
  renderBreadcrumbs();
  renderLanding();
  updateLandingVisibility();
  els.solutionPane.className = "text-secondary";
  els.solutionPane.textContent = "Please log in to use the troubleshooter.";

  return true;
}

function currentUserCanManageTree() {
  const role = state.auth && state.auth.role ? String(state.auth.role) : "";
  return role === "admin" || role === "superadmin";
}

function applyDisplayPreferencesToState(displayInput, canManageTree = currentUserCanManageTree()) {
  const display = displayInput && typeof displayInput === "object" ? displayInput : {};

  state.theme = normalizeThemeMode(display.theme, state.theme || "light");

  if (!canManageTree) {
    return;
  }

  state.uiSettings.treeQuestionColor = normalizeTreeColor(display.treeQuestionColor, DEFAULT_TREE_QUESTION_COLOR);
  state.uiSettings.treeQuestionSizePx = normalizeTreeFontSizePx(display.treeQuestionSizePx, DEFAULT_TREE_QUESTION_SIZE_PX);
  state.uiSettings.treeQuestionFontWeight = normalizeTreeFontWeight(
    normalizeTreeUnderline(display.treeQuestionBold, DEFAULT_TREE_QUESTION_FONT_WEIGHT === "700") ? "700" : "400",
    DEFAULT_TREE_QUESTION_FONT_WEIGHT
  );
  state.uiSettings.treeQuestionFontStyle = normalizeTreeFontStyle(
    normalizeTreeUnderline(display.treeQuestionItalic, DEFAULT_TREE_QUESTION_FONT_STYLE === "italic") ? "italic" : "normal",
    DEFAULT_TREE_QUESTION_FONT_STYLE
  );
  state.uiSettings.treeQuestionUnderline = normalizeTreeUnderline(display.treeQuestionUnderline, DEFAULT_TREE_QUESTION_UNDERLINE);

  state.uiSettings.treeSolutionColor = normalizeTreeColor(display.treeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR);
  state.uiSettings.treeSolutionSizePx = normalizeTreeFontSizePx(display.treeSolutionSizePx, DEFAULT_TREE_SOLUTION_SIZE_PX);
  state.uiSettings.treeSolutionFontWeight = normalizeTreeFontWeight(
    normalizeTreeUnderline(display.treeSolutionBold, DEFAULT_TREE_SOLUTION_FONT_WEIGHT === "700") ? "700" : "400",
    DEFAULT_TREE_SOLUTION_FONT_WEIGHT
  );
  state.uiSettings.treeSolutionFontStyle = normalizeTreeFontStyle(
    normalizeTreeUnderline(display.treeSolutionItalic, DEFAULT_TREE_SOLUTION_FONT_STYLE === "italic") ? "italic" : "normal",
    DEFAULT_TREE_SOLUTION_FONT_STYLE
  );
  state.uiSettings.treeSolutionUnderline = normalizeTreeUnderline(display.treeSolutionUnderline, DEFAULT_TREE_SOLUTION_UNDERLINE);

  state.uiSettings.showQuestionTextInTree = normalizeTreeUnderline(display.showQuestionTextInTree, DEFAULT_SHOW_QUESTION_TEXT_IN_TREE);
  state.uiSettings.treeQuestionTextColor = normalizeTreeColor(display.treeQuestionTextColor, DEFAULT_TREE_QUESTION_TEXT_COLOR);
  state.uiSettings.treeQuestionTextSizePx = normalizeTreeFontSizePx(display.treeQuestionTextSizePx, DEFAULT_TREE_QUESTION_TEXT_SIZE_PX);
  state.uiSettings.treeQuestionTextFontWeight = normalizeTreeFontWeight(
    normalizeTreeUnderline(display.treeQuestionTextBold, DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT === "700") ? "700" : "400",
    DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT
  );
  state.uiSettings.treeQuestionTextFontStyle = normalizeTreeFontStyle(
    normalizeTreeUnderline(display.treeQuestionTextItalic, DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE === "italic") ? "italic" : "normal",
    DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE
  );
  state.uiSettings.treeQuestionTextUnderline = normalizeTreeUnderline(display.treeQuestionTextUnderline, DEFAULT_TREE_QUESTION_TEXT_UNDERLINE);
  state.uiSettings.treeHighlightColor = normalizeTreeHighlightColor(display.treeHighlightColor, "");
}

function buildDisplayPreferencePatchFromState() {
  const questionBold = normalizeTreeFontWeight(state.uiSettings.treeQuestionFontWeight, DEFAULT_TREE_QUESTION_FONT_WEIGHT) >= "700";
  const solutionBold = normalizeTreeFontWeight(state.uiSettings.treeSolutionFontWeight, DEFAULT_TREE_SOLUTION_FONT_WEIGHT) >= "700";
  const questionTextBold = normalizeTreeFontWeight(state.uiSettings.treeQuestionTextFontWeight, DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT) >= "700";

  return {
    theme: normalizeThemeMode(state.theme, "light"),
    treeQuestionColor: normalizeTreeColor(state.uiSettings.treeQuestionColor, DEFAULT_TREE_QUESTION_COLOR),
    treeQuestionSizePx: normalizeTreeFontSizePx(state.uiSettings.treeQuestionSizePx, DEFAULT_TREE_QUESTION_SIZE_PX),
    treeQuestionBold: questionBold,
    treeQuestionItalic: normalizeTreeFontStyle(state.uiSettings.treeQuestionFontStyle, DEFAULT_TREE_QUESTION_FONT_STYLE) === "italic",
    treeQuestionUnderline: normalizeTreeUnderline(state.uiSettings.treeQuestionUnderline, DEFAULT_TREE_QUESTION_UNDERLINE),
    treeSolutionColor: normalizeTreeColor(state.uiSettings.treeSolutionColor, DEFAULT_TREE_SOLUTION_COLOR),
    treeSolutionSizePx: normalizeTreeFontSizePx(state.uiSettings.treeSolutionSizePx, DEFAULT_TREE_SOLUTION_SIZE_PX),
    treeSolutionBold: solutionBold,
    treeSolutionItalic: normalizeTreeFontStyle(state.uiSettings.treeSolutionFontStyle, DEFAULT_TREE_SOLUTION_FONT_STYLE) === "italic",
    treeSolutionUnderline: normalizeTreeUnderline(state.uiSettings.treeSolutionUnderline, DEFAULT_TREE_SOLUTION_UNDERLINE),
    showQuestionTextInTree: normalizeTreeUnderline(state.uiSettings.showQuestionTextInTree, DEFAULT_SHOW_QUESTION_TEXT_IN_TREE),
    treeQuestionTextColor: normalizeTreeColor(state.uiSettings.treeQuestionTextColor, DEFAULT_TREE_QUESTION_TEXT_COLOR),
    treeQuestionTextSizePx: normalizeTreeFontSizePx(state.uiSettings.treeQuestionTextSizePx, DEFAULT_TREE_QUESTION_TEXT_SIZE_PX),
    treeQuestionTextBold: questionTextBold,
    treeQuestionTextItalic: normalizeTreeFontStyle(state.uiSettings.treeQuestionTextFontStyle, DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE) === "italic",
    treeQuestionTextUnderline: normalizeTreeUnderline(state.uiSettings.treeQuestionTextUnderline, DEFAULT_TREE_QUESTION_TEXT_UNDERLINE),
    treeHighlightColor: normalizeTreeHighlightColor(state.uiSettings.treeHighlightColor, "")
  };
}

async function persistDisplayPreferencePatch(patchInput) {
  if (!(state.auth && state.auth.username)) {
    return { ok: false, message: "Authentication required." };
  }

  const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
  return apiRequest("/api/ui/preferences/display", {
    method: "POST",
    body: JSON.stringify({ display: patch })
  });
}

function onSettingsTreeStyleButtonClick(event) {
  const button = event && event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : null;
  if (!button) {
    return;
  }

  button.classList.toggle("active");
  button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
  onSettingsTreeAppearanceChanged().catch(() => {});
}

async function onSettingsTreeResetDefaults() {
  const canManageTree = currentUserCanManageTree();
  if (!canManageTree) {
    return;
  }

  const previous = { ...state.uiSettings };

  state.uiSettings.treeQuestionColor = DEFAULT_TREE_QUESTION_COLOR;
  state.uiSettings.treeQuestionSizePx = DEFAULT_TREE_QUESTION_SIZE_PX;
  state.uiSettings.treeQuestionFontWeight = DEFAULT_TREE_QUESTION_FONT_WEIGHT;
  state.uiSettings.treeQuestionFontStyle = DEFAULT_TREE_QUESTION_FONT_STYLE;
  state.uiSettings.treeQuestionUnderline = DEFAULT_TREE_QUESTION_UNDERLINE;
  state.uiSettings.treeSolutionColor = DEFAULT_TREE_SOLUTION_COLOR;
  state.uiSettings.treeSolutionSizePx = DEFAULT_TREE_SOLUTION_SIZE_PX;
  state.uiSettings.treeSolutionFontWeight = DEFAULT_TREE_SOLUTION_FONT_WEIGHT;
  state.uiSettings.treeSolutionFontStyle = DEFAULT_TREE_SOLUTION_FONT_STYLE;
  state.uiSettings.treeSolutionUnderline = DEFAULT_TREE_SOLUTION_UNDERLINE;
  state.uiSettings.showQuestionTextInTree = DEFAULT_SHOW_QUESTION_TEXT_IN_TREE;
  state.uiSettings.treeQuestionTextColor = DEFAULT_TREE_QUESTION_TEXT_COLOR;
  state.uiSettings.treeQuestionTextSizePx = DEFAULT_TREE_QUESTION_TEXT_SIZE_PX;
  state.uiSettings.treeQuestionTextFontWeight = DEFAULT_TREE_QUESTION_TEXT_FONT_WEIGHT;
  state.uiSettings.treeQuestionTextFontStyle = DEFAULT_TREE_QUESTION_TEXT_FONT_STYLE;
  state.uiSettings.treeQuestionTextUnderline = DEFAULT_TREE_QUESTION_TEXT_UNDERLINE;
  state.uiSettings.treeHighlightColor = "";

  applyTreeAppearanceSettings();
  renderAdminTree();
  syncAutoContrastControls();

  const result = await persistDisplayPreferencePatch(buildDisplayPreferencePatchFromState());
  if (!result.ok) {
    state.uiSettings = { ...state.uiSettings, ...previous };
    applyTreeAppearanceSettings();
    renderAdminTree();
    syncAutoContrastControls();
    showToast(result.message || "Unable to reset tree appearance.", "danger");
    return;
  }

  if (result.display && typeof result.display === "object") {
    applyDisplayPreferencesToState(result.display, true);
  }

  applyTreeAppearanceSettings();
  renderAdminTree();
  syncAutoContrastControls();
  showToast("Tree appearance reset to defaults.", "success");
}

async function onSettingsTreeAppearanceChanged() {
  const canManageTree = currentUserCanManageTree();
  if (!canManageTree) {
    return;
  }

  const previous = { ...state.uiSettings };

  state.uiSettings.treeQuestionColor = normalizeTreeColor(
    els.settingsTreeQuestionColor ? els.settingsTreeQuestionColor.value : state.uiSettings.treeQuestionColor,
    DEFAULT_TREE_QUESTION_COLOR
  );
  state.uiSettings.treeQuestionSizePx = normalizeTreeFontSizePx(
    els.settingsTreeQuestionSize ? els.settingsTreeQuestionSize.value : state.uiSettings.treeQuestionSizePx,
    DEFAULT_TREE_QUESTION_SIZE_PX
  );
  state.uiSettings.treeQuestionFontWeight = els.settingsTreeQuestionBold && els.settingsTreeQuestionBold.classList.contains("active") ? "700" : "400";
  state.uiSettings.treeQuestionFontStyle = els.settingsTreeQuestionItalic && els.settingsTreeQuestionItalic.classList.contains("active") ? "italic" : "normal";
  state.uiSettings.treeQuestionUnderline = Boolean(els.settingsTreeQuestionUnderline && els.settingsTreeQuestionUnderline.classList.contains("active"));

  state.uiSettings.treeSolutionColor = normalizeTreeColor(
    els.settingsTreeSolutionColor ? els.settingsTreeSolutionColor.value : state.uiSettings.treeSolutionColor,
    DEFAULT_TREE_SOLUTION_COLOR
  );
  state.uiSettings.treeSolutionSizePx = normalizeTreeFontSizePx(
    els.settingsTreeSolutionSize ? els.settingsTreeSolutionSize.value : state.uiSettings.treeSolutionSizePx,
    DEFAULT_TREE_SOLUTION_SIZE_PX
  );
  state.uiSettings.treeSolutionFontWeight = els.settingsTreeSolutionBold && els.settingsTreeSolutionBold.classList.contains("active") ? "700" : "400";
  state.uiSettings.treeSolutionFontStyle = els.settingsTreeSolutionItalic && els.settingsTreeSolutionItalic.classList.contains("active") ? "italic" : "normal";
  state.uiSettings.treeSolutionUnderline = Boolean(els.settingsTreeSolutionUnderline && els.settingsTreeSolutionUnderline.classList.contains("active"));

  state.uiSettings.showQuestionTextInTree = Boolean(els.settingsShowQuestionTextInTree && els.settingsShowQuestionTextInTree.checked);
  state.uiSettings.treeQuestionTextColor = normalizeTreeColor(
    els.settingsTreeQuestionTextColor ? els.settingsTreeQuestionTextColor.value : state.uiSettings.treeQuestionTextColor,
    DEFAULT_TREE_QUESTION_TEXT_COLOR
  );
  state.uiSettings.treeQuestionTextSizePx = normalizeTreeFontSizePx(
    els.settingsTreeQuestionTextSize ? els.settingsTreeQuestionTextSize.value : state.uiSettings.treeQuestionTextSizePx,
    DEFAULT_TREE_QUESTION_TEXT_SIZE_PX
  );
  state.uiSettings.treeQuestionTextFontWeight = els.settingsTreeQuestionTextBold && els.settingsTreeQuestionTextBold.classList.contains("active") ? "700" : "400";
  state.uiSettings.treeQuestionTextFontStyle = els.settingsTreeQuestionTextItalic && els.settingsTreeQuestionTextItalic.classList.contains("active") ? "italic" : "normal";
  state.uiSettings.treeQuestionTextUnderline = Boolean(els.settingsTreeQuestionTextUnderline && els.settingsTreeQuestionTextUnderline.classList.contains("active"));

  state.uiSettings.treeHighlightColor = normalizeTreeHighlightColor(
    els.settingsTreeHighlightColor ? els.settingsTreeHighlightColor.value : state.uiSettings.treeHighlightColor,
    defaultTreeHighlightColorForTheme(state.theme)
  );

  applyTreeAppearanceSettings();
  renderAdminTree();
  syncAutoContrastControls();

  const result = await persistDisplayPreferencePatch(buildDisplayPreferencePatchFromState());
  if (!result.ok) {
    state.uiSettings = { ...state.uiSettings, ...previous };
    applyTreeAppearanceSettings();
    renderAdminTree();
    syncAutoContrastControls();
    showToast(result.message || "Unable to save tree appearance.", "danger");
    return;
  }

  if (result.display && typeof result.display === "object") {
    applyDisplayPreferencesToState(result.display, true);
  }

  applyTreeAppearanceSettings();
  renderAdminTree();
  syncAutoContrastControls();
  showToast("Tree appearance saved.", "success");
}

async function onSettingsThemeModeChanged() {
  const selectedTheme = els.settingsThemeMode ? els.settingsThemeMode.value : state.theme;
  const nextTheme = normalizeThemeMode(selectedTheme, state.theme || "light");
  if (nextTheme === state.theme) {
    return;
  }

  const previousTheme = state.theme;
  applyTheme(nextTheme);

  const result = await persistDisplayPreferencePatch({ theme: nextTheme });
  if (!result.ok) {
    applyTheme(previousTheme);
    syncAutoContrastControls();
    showToast(result.message || "Unable to save theme.", "danger");
    return;
  }

  if (result.display && typeof result.display === "object") {
    applyDisplayPreferencesToState(result.display, currentUserCanManageTree());
  }

  applyTheme(state.theme);
  syncAutoContrastControls();
  refreshFlagDependentRender();
  showToast("Display setting saved.", "success");
}

function renderNavActions() {
  els.navActions.innerHTML = "";
  const role = state.auth ? state.auth.role : null;

  if (!role) {
    els.navActions.append(buildButton("Log In", "btn-outline-primary", () => state.modals.login.show()));
    syncNavSearchAvailability();
    if (shouldShowLanding()) {
      renderLanding();
    }
    return;
  }

  if (role === "admin" || role === "superadmin") {
    els.navActions.append(buildButton("Edit", "btn-outline-secondary", openAdminOverlay));
  }

  if (role === "superadmin") {
    els.navActions.append(buildButton("Users", "btn-outline-secondary", openUsersOverlay));

  }

  els.navActions.append(buildButton("Settings", "btn-outline-secondary", openSettingsModal));

  els.navActions.append(
    buildButton("Log Out", "btn-outline-danger", async () => {
      const logoutResult = await apiRequest("/api/auth/logout", { method: "POST" });
      state.auth = null;
      state.authMode = logoutResult.authMode || state.authMode;
      renderNavActions();
      closeUsersOverlay();

      closeSettingsModal();
      await closeAdminOverlay();
      handleRequiredAuthGate();
    })
  );

  syncNavSearchAvailability();
  if (shouldShowLanding()) {
    renderLanding();
  }
}

function syncNavSearchAvailability() {
  if (!els.navSearchInput) {
    return;
  }

  const setupVisible = els.setupSection && !els.setupSection.classList.contains("d-none");
  const authBlocked = state.authMode === "required" && !state.auth;
  const disabled = setupVisible || authBlocked;

  els.navSearchInput.disabled = disabled;
  if (setupVisible) {
    els.navSearchInput.placeholder = "Search available after setup";
  } else if (authBlocked) {
    els.navSearchInput.placeholder = "Log in to search solutions";
  } else {
    els.navSearchInput.placeholder = "Search solutions";
  }

  if (disabled) {
    resetSearchState();
  }
}

function resetSearchState(options = {}) {
  const keepQuery = Boolean(options.keepQuery);

  if (state.search.debounceTimer) {
    window.clearTimeout(state.search.debounceTimer);
    state.search.debounceTimer = null;
  }

  state.search.requestToken += 1;
  state.search.loading = false;
  state.search.open = false;
  state.search.error = "";
  state.search.page = 1;
  state.search.total = 0;
  state.search.totalPages = 0;
  state.search.results = [];

  if (!keepQuery) {
    state.search.query = "";
    if (els.navSearchInput) {
      els.navSearchInput.value = "";
    }
  }

  renderNavSearchResults();
}

function closeSearchResults() {
  if (!state.search.open) {
    return;
  }

  state.search.open = false;
  renderNavSearchResults();
}

function onNavSearchSubmit(event) {
  event.preventDefault();
  if (!els.navSearchInput) {
    return;
  }

  state.search.query = String(els.navSearchInput.value || "").trim();
  if (normalizeSearchQuery(state.search.query).length < SEARCH_MIN_QUERY_LENGTH) {
    state.search.open = true;
    renderNavSearchResults();
    return;
  }

  if (state.search.debounceTimer) {
    window.clearTimeout(state.search.debounceTimer);
    state.search.debounceTimer = null;
  }

  void performNavSearch(1);
}

function onNavSearchInputChanged(event) {
  state.search.query = String(event.target && event.target.value ? event.target.value : "").trim();
  state.search.page = 1;
  state.search.error = "";

  if (state.search.debounceTimer) {
    window.clearTimeout(state.search.debounceTimer);
    state.search.debounceTimer = null;
  }

  const normalized = normalizeSearchQuery(state.search.query);
  if (!state.search.query) {
    resetSearchState({ keepQuery: true });
    return;
  }

  state.search.open = true;

  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) {
    state.search.loading = false;
    state.search.results = [];
    state.search.total = 0;
    state.search.totalPages = 0;
    renderNavSearchResults();
    return;
  }

  state.search.loading = true;
  renderNavSearchResults();

  state.search.debounceTimer = window.setTimeout(() => {
    state.search.debounceTimer = null;
    void performNavSearch(1);
  }, SEARCH_DEBOUNCE_MS);
}

function onNavSearchInputFocused() {
  const query = String(state.search.query || "").trim();
  if (!query || normalizeSearchQuery(query).length < SEARCH_MIN_QUERY_LENGTH) {
    return;
  }

  state.search.open = true;
  renderNavSearchResults();
}

function onGlobalClickForSearchDismiss(event) {
  if (!state.search.open) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (
    (els.navSearchForm && els.navSearchForm.contains(target))
    || (els.navSearchResults && els.navSearchResults.contains(target))
  ) {
    return;
  }

  closeSearchResults();
}

function onGlobalKeydownForSearchDismiss(event) {
  if (event.key === "Escape") {
    closeSearchResults();
    if (els.navSearchInput && document.activeElement !== els.navSearchInput) {
      els.navSearchInput.focus();
    }
  }
}

function onNavSearchInputKeydown(event) {
  if (event.key !== "ArrowDown") {
    return;
  }

  const firstItem = els.navSearchResults ? els.navSearchResults.querySelector(".kbn-search-item") : null;
  if (!(firstItem instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  firstItem.focus();
}

function onNavSearchResultsKeydown(event) {
  if (!els.navSearchResults) {
    return;
  }

  const items = Array.from(els.navSearchResults.querySelectorAll(".kbn-search-item"));
  if (!items.length) {
    if (event.key === "Escape") {
      closeSearchResults();
      if (els.navSearchInput) {
        els.navSearchInput.focus();
      }
    }
    return;
  }

  const currentIndex = items.indexOf(document.activeElement);

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    items[nextIndex].focus();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (currentIndex <= 0) {
      if (els.navSearchInput) {
        els.navSearchInput.focus();
      }
      return;
    }
    items[currentIndex - 1].focus();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeSearchResults();
    if (els.navSearchInput) {
      els.navSearchInput.focus();
    }
  }
}

async function performNavSearch(page) {
  const query = String(state.search.query || "").trim();
  const normalized = normalizeSearchQuery(query);

  if (!query || normalized.length < SEARCH_MIN_QUERY_LENGTH) {
    state.search.loading = false;
    renderNavSearchResults();
    return;
  }

  const nextPage = parseSearchPage(page, 1);
  const requestToken = state.search.requestToken + 1;
  state.search.requestToken = requestToken;
  state.search.loading = true;
  state.search.error = "";
  state.search.open = true;
  renderNavSearchResults();

  const result = await apiRequest(`/api/search?q=${encodeURIComponent(query)}&page=${nextPage}&pageSize=${SEARCH_PAGE_SIZE}`);

  if (requestToken !== state.search.requestToken) {
    return;
  }

  if (!result.ok) {
    if (result._status === 401) {
      handleRequiredAuthGate();
    }
    state.search.loading = false;
    state.search.results = [];
    state.search.total = 0;
    state.search.totalPages = 0;
    state.search.error = result.message || "Search failed.";
    state.search.open = true;
    renderNavSearchResults();
    return;
  }

  state.search.loading = false;
  state.search.error = "";
  state.search.page = parseSearchPage(result.page, nextPage);
  state.search.pageSize = parseSearchPage(result.pageSize, SEARCH_PAGE_SIZE);
  state.search.total = Number.isFinite(Number(result.total)) ? Number(result.total) : 0;
  state.search.totalPages = state.search.total > 0 ? parseSearchPage(result.totalPages, 1) : 0;
  state.search.results = Array.isArray(result.results) ? result.results : [];
  state.search.open = true;
  renderNavSearchResults();
}

function renderNavSearchResults() {
  if (!els.navSearchResults) {
    return;
  }

  els.navSearchResults.innerHTML = "";
  els.navSearchResults.setAttribute("aria-busy", state.search.loading ? "true" : "false");

  const query = String(state.search.query || "").trim();
  if (!state.search.open || !query) {
    els.navSearchResults.classList.add("d-none");
    return;
  }

  const normalized = normalizeSearchQuery(query);
  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) {
    appendSearchStatus(`Type at least ${SEARCH_MIN_QUERY_LENGTH} characters.`);
    els.navSearchResults.classList.remove("d-none");
    return;
  }

  if (state.search.loading) {
    appendSearchStatus("Searching...");
    els.navSearchResults.classList.remove("d-none");
    return;
  }

  if (state.search.error) {
    appendSearchStatus(state.search.error, "text-danger");
    els.navSearchResults.classList.remove("d-none");
    return;
  }

  if (!state.search.results.length) {
    appendSearchStatus("No matching solutions found.");
    els.navSearchResults.classList.remove("d-none");
    return;
  }

  for (const result of state.search.results) {
    els.navSearchResults.append(buildSearchResultItem(result));
  }

  if (state.search.totalPages > 1) {
    els.navSearchResults.append(buildSearchPagination());
  }

  els.navSearchResults.classList.remove("d-none");
}

function appendSearchStatus(message, className = "") {
  const status = document.createElement("div");
  status.className = `kbn-search-status${className ? ` ${className}` : ""}`;
  status.textContent = message;
  els.navSearchResults.append(status);
}

function buildSearchResultItem(result) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "kbn-search-item";

  const pathValue = String(result && result.path ? result.path : "");
  item.dataset.searchPath = pathValue;

  const fallbackLabel = pathValue.split("/").filter(Boolean).pop() || "(Untitled)";
  const label = String(result && result.label ? result.label : fallbackLabel);
  item.setAttribute("aria-label", `Open solution ${label}`);
  const snippetText = String(result && result.snippet ? result.snippet : "").trim();
  const terms = Array.isArray(result && result.highlightTerms) ? result.highlightTerms : [];

  const titleRow = document.createElement("div");
  titleRow.className = "kbn-search-title-row";

  const decorators = optionSelectorFlags({
    terminal: true,
    restricted: false,
    flags: Array.isArray(result && result.flags) ? result.flags : []
  });

  if (decorators.length) {
    const iconWrap = document.createElement("span");
    iconWrap.className = "kbn-search-flag-icons";
    decorators.slice(0, 3).forEach((decorator) => {
      const icon = document.createElement("i");
      icon.className = `bi ${decorator.iconClass}`;
      icon.setAttribute("aria-hidden", "true");

      const chip = document.createElement("span");
      const colorMeta = flagColorMeta(decorator.colorClass || "", "", decorator.backgroundColor || "");
      if (colorMeta.className) {
        chip.classList.add(colorMeta.className);
      }
      if (colorMeta.needsChip) {
        chip.classList.add("kbn-flag-chip");
      }
      if (colorMeta.styleColor) {
        chip.style.color = colorMeta.styleColor;
      }
      if (colorMeta.needsChip && colorMeta.chipBackground) {
        chip.style.backgroundColor = colorMeta.chipBackground;
      }
      chip.append(icon);
      iconWrap.append(chip);
    });
    appendFlagScreenReaderText(iconWrap, decorators);
    titleRow.append(iconWrap);
  }

  const title = document.createElement("div");
  title.className = "kbn-search-title";
  title.innerHTML = highlightSearchText(label, terms);
  titleRow.append(title);
  item.append(titleRow);

  const pathLine = document.createElement("div");
  pathLine.className = "kbn-search-path";
  pathLine.innerHTML = highlightSearchText(pathValue, terms);
  item.append(pathLine);

  if (snippetText) {
    const snippet = document.createElement("div");
    snippet.className = "kbn-search-snippet";
    snippet.innerHTML = highlightSearchText(snippetText, terms);
    item.append(snippet);
  }

  return item;
}

function buildSearchPagination() {
  const wrapper = document.createElement("div");
  wrapper.className = "kbn-search-pagination";

  const previousBtn = document.createElement("button");
  previousBtn.type = "button";
  previousBtn.className = "btn btn-sm btn-outline-secondary";
  previousBtn.textContent = "Previous";
  previousBtn.dataset.searchPage = String(Math.max(1, state.search.page - 1));
  previousBtn.disabled = state.search.page <= 1;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-sm btn-outline-secondary";
  nextBtn.textContent = "Next";
  nextBtn.dataset.searchPage = String(Math.min(state.search.totalPages, state.search.page + 1));
  nextBtn.disabled = state.search.page >= state.search.totalPages;

  const meta = document.createElement("div");
  meta.className = "small text-secondary";
  const plural = state.search.total === 1 ? "" : "s";
  meta.textContent = `Page ${state.search.page} of ${state.search.totalPages} - ${state.search.total} result${plural}`;

  wrapper.append(previousBtn, meta, nextBtn);
  return wrapper;
}

function onNavSearchResultsClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const pageBtn = target.closest("button[data-search-page]");
  if (pageBtn) {
    if (pageBtn.disabled) {
      return;
    }
    const nextPage = parseSearchPage(pageBtn.dataset.searchPage, state.search.page);
    if (nextPage !== state.search.page) {
      void performNavSearch(nextPage);
    }
    return;
  }

  const item = target.closest("button[data-search-path]");
  if (!item) {
    return;
  }

  const pathValue = String(item.dataset.searchPath || "").trim();
  if (!pathValue) {
    return;
  }

  void openPathFromSearch(pathValue);
}

async function openPathFromSearch(pathValue) {
  const segments = String(pathValue || "")
    .replaceAll("\\", "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!segments.length) {
    return;
  }

  state.selectedPaths = segments.map((_, index) => segments.slice(0, index + 1).join("/"));
  state.landing.dismissed = true;
  closeSearchResults();
  await rebuildFlow({ pushHistory: true, replaceHistory: false });
}

function normalizeSearchQuery(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSearchPage(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return Math.floor(numeric);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSearchText(value, terms) {
  let output = escapeHtml(value || "");
  const normalizedTerms = Array.isArray(terms)
    ? terms
      .map((term) => String(term || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
    : [];

  for (const term of normalizedTerms) {
    const pattern = new RegExp(`(${escapeRegExp(term)})`, "ig");
    output = output.replace(pattern, '<mark class="kbn-search-mark">$1</mark>');
  }

  return output;
}

function onLandingPrimaryClicked() {
  const action = els.landingPrimaryBtn && els.landingPrimaryBtn.dataset
    ? String(els.landingPrimaryBtn.dataset.action || "")
    : "";
  void runLandingAction(action || "start");
}

function onLandingTopicsClick(event) {
  const target = event && event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }

  const topicButton = target.closest("button[data-topic-path]");
  if (!topicButton) {
    return;
  }

  const topicPath = String(topicButton.dataset.topicPath || "").trim();
  if (!topicPath) {
    return;
  }

  void openPathFromLanding(topicPath);
}

async function runLandingAction(actionInput) {
  const action = String(actionInput || "").trim().toLowerCase();

  if (action === "login") {
    state.modals.login.show();
    return;
  }

  if (action === "start") {
    if (state.authMode === "required" && !state.auth) {
      state.modals.login.show();
      return;
    }

    state.landing.dismissed = true;
    updateLandingVisibility();
    focusFirstStepToggle();
  }
}

async function openPathFromLanding(topicPath) {
  const normalized = String(topicPath || "").trim();
  if (!normalized) {
    return;
  }

  state.landing.dismissed = true;
  state.selectedPaths = [normalized];
  await rebuildFlow({ pushHistory: true, replaceHistory: false });
}

function focusFirstStepToggle() {
  const firstToggle = els.steps ? els.steps.querySelector(".kbn-step-toggle") : null;
  if (!(firstToggle instanceof HTMLElement)) {
    return;
  }

  firstToggle.focus();
  firstToggle.scrollIntoView({ behavior: "smooth", block: "center" });
}

function shouldShowLanding() {
  return !state.landing.dismissed && state.selectedPaths.length === 0;
}

function updateLandingVisibility() {
  const showLanding = shouldShowLanding();

  if (els.landingSection) {
    els.landingSection.classList.toggle("d-none", !showLanding);
  }
  if (els.troubleshooterFlow) {
    els.troubleshooterFlow.classList.toggle("d-none", showLanding);
  }

  if (showLanding) {
    renderLanding();
  }
}

function renderLanding() {
  if (!els.landingSection) {
    return;
  }

  const authRequired = state.authMode === "required";
  const isLoggedIn = Boolean(state.auth);
  const canBrowseTopics = !authRequired || isLoggedIn;
  const solutionCount = Number.isFinite(Number(state.landing.solutionCount))
    ? Math.max(0, Math.floor(Number(state.landing.solutionCount)))
    : 0;

  if (els.landingTopicCount) {
    els.landingTopicCount.textContent = String(solutionCount);
  }

  let title = "Welcome to KB Navigator";
  let subtitle = "Find and resolve common IT issues with a guided path.";
  let primary = { label: "Start Troubleshooting", action: "start", className: "btn btn-primary", hidden: false };

  if (authRequired && !isLoggedIn) {
    title = "Sign in to access your troubleshooting knowledgebase";
    subtitle = "Authentication is required before topics and solutions can be viewed.";
  } else if (isLoggedIn) {
    title = "Resolve IT issues faster with guided troubleshooting";
    subtitle = "Pick a topic, follow each decision point, and land on a targeted solution.";
  }

  if (els.landingTitle) {
    els.landingTitle.textContent = title;
  }
  if (els.landingSubtitle) {
    els.landingSubtitle.textContent = subtitle;
  }

  configureLandingButton(els.landingPrimaryBtn, primary);
  renderLandingTopics(canBrowseTopics);
}

function configureLandingButton(button, options) {
  if (!button) {
    return;
  }

  const config = options || {};
  const hidden = Boolean(config.hidden);
  button.className = config.className || "btn btn-outline-secondary";
  button.textContent = String(config.label || "");
  button.dataset.action = String(config.action || "");
  button.classList.toggle("d-none", hidden);
}

function renderLandingTopics(canBrowseTopics) {
  if (!els.landingTopicsList) {
    return;
  }

  els.landingTopicsList.innerHTML = "";

  if (!canBrowseTopics) {
    const helper = document.createElement("div");
    helper.className = "small text-secondary";
    helper.textContent = "Log in to view available topics.";
    els.landingTopicsList.append(helper);
    return;
  }

  const topics = Array.isArray(state.topics) ? state.topics.slice(0, 8) : [];
  if (!topics.length) {
    const helper = document.createElement("div");
    helper.className = "small text-secondary";
    helper.textContent = "No topics are available yet.";
    els.landingTopicsList.append(helper);
    return;
  }

  topics.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-secondary btn-sm text-start";
    button.dataset.topicPath = String(topic.path || "");
    button.innerHTML = `<i class="bi bi-folder2-open me-2" aria-hidden="true"></i>${escapeHtml(String(topic.label || topic.path || "(Untitled)"))}`;
    els.landingTopicsList.append(button);
  });
}

async function loadPublicStats() {
  const statsResult = await apiRequest("/api/public/stats");
  if (!statsResult.ok) {
    return;
  }

  const nextCount = Number(statsResult.solutionCount);
  if (!Number.isFinite(nextCount) || nextCount < 0) {
    return;
  }

  state.landing.solutionCount = Math.floor(nextCount);
}

async function loadTopics() {
  await loadPublicStats();
  const topicsResult = await apiRequest("/api/topics");
  if (!topicsResult.ok && topicsResult._status === 401) {
    state.topics = [];
    handleRequiredAuthGate();
    return;
  }

  state.topics = topicsResult.ok ? topicsResult.topics || [] : [];
}

async function rebuildFlow({ pushHistory, replaceHistory }) {
  const steps = [{ question: "Select a topic", options: state.topics, selectedPath: null }];
  const validSelections = [];
  let terminal = null;

  for (let i = 0; i < state.selectedPaths.length; i += 1) {
    const selectedPath = state.selectedPaths[i];
    const step = steps[i];
    if (!step || !step.options.some((opt) => opt.path === selectedPath)) {
      break;
    }

    step.selectedPath = selectedPath;
    validSelections.push(selectedPath);

    const nodeResult = await apiRequest(`/api/node?path=${encodeURIComponent(selectedPath)}`);
    if (!nodeResult.ok || nodeResult.type === "missing") {
      terminal = { type: "missing", message: "No solution available." };
      break;
    }

    if (nodeResult.type === "terminal") {
      terminal = nodeResult;
      break;
    }

    if (nodeResult.type === "node") {
      steps.push({
        question: nodeResult.question || "Select an option",
        options: nodeResult.answers || [],
        selectedPath: null
      });
    }
  }

  state.selectedPaths = validSelections;
  state.steps = steps;
  state.terminal = terminal;

  renderSteps();
  renderSolution();
  renderBreadcrumbs();
  updateLandingVisibility();

  const selectedTail = state.selectedPaths[state.selectedPaths.length - 1] || "";
  updatePathQuery(selectedTail, { pushHistory, replaceHistory });
}

function renderSteps() {
  els.steps.innerHTML = "";

  state.steps.forEach((step, index) => {
    const wrapper = document.createElement("div");
    const label = document.createElement("div");
    label.className = "form-label fw-medium";
    label.textContent = step.question;

    const stepControlId = `kbn-step-${index}`;
    label.id = `${stepControlId}-label`;

    const dropdown = document.createElement("div");
    dropdown.className = "dropdown";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = `${stepControlId}-toggle`;
    toggle.className = "btn btn-outline-secondary dropdown-toggle w-100 text-start kbn-step-toggle";
    toggle.setAttribute("data-bs-toggle", "dropdown");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-labelledby", label.id);
    toggle.setAttribute("aria-controls", `${stepControlId}-menu`);

    const selectedOption = step.options.find((option) => option.path === step.selectedPath) || null;
    if (selectedOption) {
      appendStepOptionContent(toggle, selectedOption);
    } else {
      appendStepResetIcon(toggle, "text-secondary");
    }

    const menu = document.createElement("div");
    menu.id = `${stepControlId}-menu`;
    menu.className = "dropdown-menu w-100 kbn-step-menu";

    const resetItem = document.createElement("button");
    resetItem.type = "button";
    resetItem.className = "dropdown-item text-secondary kbn-step-reset";
    appendStepResetIcon(resetItem);
    if (!step.selectedPath) {
      resetItem.classList.add("active");
      resetItem.setAttribute("aria-current", "true");
    }
    resetItem.addEventListener("click", async () => {
      state.selectedPaths = state.selectedPaths.slice(0, index);
      await rebuildFlow({ pushHistory: true, replaceHistory: false });
    });
    menu.append(resetItem);

    if (!step.options.length) {
      const empty = document.createElement("div");
      empty.className = "dropdown-item-text text-secondary";
      empty.textContent = "No options available.";
      menu.append(empty);
      toggle.disabled = true;
    } else {
      step.options.forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dropdown-item kbn-step-option";
        if (option.path === step.selectedPath) {
          item.classList.add("active");
          item.setAttribute("aria-current", "true");
        }

        appendStepOptionContent(item, option);

        item.addEventListener("click", async () => {
          state.selectedPaths = state.selectedPaths.slice(0, index);
          state.selectedPaths.push(option.path);
          await rebuildFlow({ pushHistory: true, replaceHistory: false });
        });

        menu.append(item);
      });
    }

    dropdown.append(toggle, menu);
    wrapper.append(label, dropdown);
    els.steps.append(wrapper);
  });
}

function optionLabel(option) {
  if (!option || typeof option !== "object") {
    return "";
  }

  return option.label || "";
}

function appendStepResetIcon(container, colorClass = "") {
  if (colorClass) {
    container.classList.add(colorClass);
  }

  const icon = document.createElement("i");
  icon.className = "bi bi-arrow-90deg-up";
  icon.setAttribute("aria-hidden", "true");
  container.append(icon);

  container.setAttribute("aria-label", "Go up one level");
  container.setAttribute("title", "Go up one level");
}

function flagAccessibleNames(decorators) {
  if (!Array.isArray(decorators)) {
    return [];
  }

  return decorators
    .map((decorator) => String((decorator && (decorator.name || decorator.message)) || "").trim())
    .filter(Boolean);
}

function appendFlagScreenReaderText(container, decorators, prefix = "Flags") {
  const names = flagAccessibleNames(decorators);
  if (!names.length) {
    return;
  }

  const srOnly = document.createElement("span");
  srOnly.className = "visually-hidden";
  srOnly.textContent = `${prefix}: ${names.join(", ")}`;
  container.append(srOnly);
}
function appendStepOptionIcons(container, decorators) {
  if (!Array.isArray(decorators) || !decorators.length) {
    return;
  }

  const maxIcons = 3;
  const visible = decorators.slice(0, maxIcons);
  const hiddenCount = decorators.length - visible.length;

  const iconWrap = document.createElement("span");
  iconWrap.className = "kbn-step-option-icons me-2";

  visible.forEach((decorator) => {
    const icon = document.createElement("i");
    icon.className = `bi ${decorator.iconClass} kbn-step-option-icon`;
    icon.setAttribute("aria-hidden", "true");

    const colorMeta = flagColorMeta(decorator.colorClass || "", "", decorator.backgroundColor || "");

    const chip = document.createElement("span");
    if (colorMeta.className) {
      chip.classList.add(colorMeta.className);
    }
    if (colorMeta.needsChip) {
      chip.classList.add("kbn-flag-chip");
    }
    if (colorMeta.styleColor) {
      chip.style.color = colorMeta.styleColor;
    }
    if (colorMeta.needsChip && colorMeta.chipBackground) {
      chip.style.backgroundColor = colorMeta.chipBackground;
    }
    chip.append(icon);

    const titleParts = [];
    if (decorator.name) {
      titleParts.push(decorator.name);
    }
    if (decorator.message) {
      titleParts.push(decorator.message);
    }
    if (decorator.blocking) {
      titleParts.push("Access controlled");
    }
    chip.setAttribute("title", titleParts.join(": ") || "Flag");
    iconWrap.append(chip);
  });

  if (hiddenCount > 0) {
    const more = document.createElement("span");
    more.className = "kbn-step-option-more text-secondary";
    more.textContent = `+${hiddenCount}`;
    more.setAttribute("title", `${hiddenCount} more flag${hiddenCount === 1 ? "" : "s"}`);
    iconWrap.append(more);
  }

  appendFlagScreenReaderText(iconWrap, decorators);

  container.append(iconWrap);
}

function appendStepOptionContent(container, option) {
  const decorators = optionSelectorFlags(option);
  appendStepOptionIcons(container, decorators);

  const text = document.createElement("span");
  text.className = "kbn-step-option-label";
  text.textContent = optionLabel(option) || "(Untitled)";
  container.append(text);
}

function renderSolution() {
  els.solutionPane.style.color = "";
  if (!state.selectedPaths.length) {
    els.solutionPane.className = "text-secondary";
    els.solutionPane.textContent = "Select a topic to begin.";
    return;
  }

  if (!state.terminal) {
    els.solutionPane.className = "text-secondary";
    els.solutionPane.textContent = "Continue selecting options to reach a solution.";
    return;
  }

  if (state.terminal.type === "missing") {
    els.solutionPane.className = "text-danger";
    els.solutionPane.textContent = "No solution available.";
    return;
  }

  if (state.terminal.restricted) {
    const blockingFlag = state.terminal.blockingFlag || null;
    const colorMeta = blockingFlag ? flagColorMeta(blockingFlag.colorClass, "text-danger", blockingFlag.backgroundColor) : flagColorMeta("", "text-danger");
    const iconHtml = blockingFlag ? flagIconHtml(blockingFlag.iconClass, "me-2") : "";
    const message = state.terminal.message || "This solution is restricted at this time.";
    const messageHtml = flagTextHtml(`${iconHtml}${escapeHtml(message)}`, colorMeta, "fw-medium", { fillWidth: true });

    els.solutionPane.className = "";
    els.solutionPane.innerHTML = messageHtml;
    return;
  }

  const flags = Array.isArray(state.terminal.flags) ? state.terminal.flags : [];
  const banners = flags
    .map((flag) => {
      const message = String(flag && flag.message ? flag.message : "").trim();
      if (!message) {
        return "";
      }

      const colorMeta = flagColorMeta(flag.colorClass, "text-secondary", flag.backgroundColor);
      const iconHtml = flagIconHtml(flag.iconClass, "me-2");
      const messageHtml = flagTextHtml(`${iconHtml}${escapeHtml(message)}`, colorMeta, "", { fillWidth: true });
      return `<div class="border rounded py-2 px-3 mb-2">${messageHtml}</div>`;
    })
    .filter(Boolean)
    .join("");

  els.solutionPane.className = "";
  els.solutionPane.innerHTML = `${banners}${state.terminal.solutionHtml || ""}`;
}

function renderBreadcrumbs() {
  els.breadcrumbs.innerHTML = "";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "breadcrumb");

  const ol = document.createElement("ol");
  ol.className = "breadcrumb mb-0";

  const rootItem = document.createElement("li");
  rootItem.className = "breadcrumb-item";
  const rootLink = document.createElement("a");
  rootLink.href = "#";
  rootLink.textContent = "Start";
  rootLink.addEventListener("click", async (event) => {
    event.preventDefault();
    state.selectedPaths = [];
    await rebuildFlow({ pushHistory: true, replaceHistory: false });
  });
  rootItem.append(rootLink);
  ol.append(rootItem);

  if (state.selectedPaths.length > 0) {
    const segments = state.selectedPaths[state.selectedPaths.length - 1].split("/");
    segments.forEach((segment, index) => {
      const li = document.createElement("li");
      li.className = "breadcrumb-item";

      if (index === segments.length - 1) {
        li.classList.add("active");
        li.setAttribute("aria-current", "page");
        li.textContent = segment;
      } else {
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = segment;
        link.addEventListener("click", async (event) => {
          event.preventDefault();
          state.selectedPaths = state.selectedPaths.slice(0, index + 1);
          await rebuildFlow({ pushHistory: true, replaceHistory: false });
        });
        li.append(link);
      }

      ol.append(li);
    });
  }

  nav.append(ol);
  els.breadcrumbs.append(nav);
}
function isAdminCompactViewport() {
  return typeof window !== "undefined" && window.innerWidth < ADMIN_COMPACT_BREAKPOINT_PX;
}

function updateAdminCompactPaneButtons() {
  const activePane = state.admin.compactPane === "editor" ? "editor" : "tree";

  if (els.adminPaneTreeBtn) {
    const active = activePane === "tree";
    els.adminPaneTreeBtn.classList.toggle("active", active);
    els.adminPaneTreeBtn.setAttribute("aria-selected", active ? "true" : "false");
    els.adminPaneTreeBtn.setAttribute("tabindex", active ? "0" : "-1");
  }

  if (els.adminPaneEditorBtn) {
    const active = activePane === "editor";
    els.adminPaneEditorBtn.classList.toggle("active", active);
    els.adminPaneEditorBtn.setAttribute("aria-selected", active ? "true" : "false");
    els.adminPaneEditorBtn.setAttribute("tabindex", active ? "0" : "-1");
  }
}

function focusAdminCompactPane(pane) {
  if (!els.adminOverlay || !state.admin.compactMode) {
    return;
  }

  const selector = pane === "editor"
    ? "#adminActionBar button, #adminPanelBody button, #adminPanelBody a, #adminPanelBody input, #adminPanelBody select, #adminPanelBody textarea"
    : "#adminTreePane .tree-button.active, #adminTreePane .tree-button";

  const focusTarget = els.adminOverlay.querySelector(selector);
  if (focusTarget && typeof focusTarget.focus === "function") {
    focusTarget.focus();
  }
}

function syncAdminResponsiveLayout(options = {}) {
  const preservePane = Boolean(options.preservePane);
  const compactMode = isAdminCompactViewport();

  state.admin.compactMode = compactMode;
  if (!preservePane && compactMode) {
    state.admin.compactPane = "tree";
  }
  if (!["tree", "editor"].includes(state.admin.compactPane)) {
    state.admin.compactPane = "tree";
  }

  if (els.adminOverlay) {
    els.adminOverlay.classList.toggle("kbn-admin-compact-mode", compactMode);
    els.adminOverlay.dataset.adminPane = compactMode
      ? state.admin.compactPane
      : "split";
  }

  if (els.adminCompactPaneSwitch) {
    els.adminCompactPaneSwitch.classList.toggle("d-none", !compactMode);
  }

  updateAdminCompactPaneButtons();
}

function setAdminCompactPane(paneInput, options = {}) {
  const pane = paneInput === "editor" ? "editor" : "tree";
  state.admin.compactPane = pane;
  syncAdminResponsiveLayout({ preservePane: true });

  if (Boolean(options.focus)) {
    focusAdminCompactPane(pane);
  }
}

function computeResponsiveSummernoteHeight() {
  const viewportHeight = Number(window.innerHeight) || 900;
  const compactViewport = Number(window.innerWidth) < ADMIN_COMPACT_BREAKPOINT_PX;
  const defaultHeight = compactViewport ? 260 : 360;
  let candidate = compactViewport
    ? Math.floor(viewportHeight * 0.35)
    : defaultHeight;

  const solutionModalBody = document.querySelector("#solutionModal .modal-body");
  if (solutionModalBody && solutionModalBody.clientHeight > 0) {
    const draftBannerHeight = els.draftBanner && !els.draftBanner.classList.contains("d-none")
      ? els.draftBanner.offsetHeight
      : 0;
    const flagsSectionHeight = els.solutionFlagsSection && !els.solutionFlagsSection.classList.contains("d-none")
      ? els.solutionFlagsSection.offsetHeight
      : 0;
    const messageHeight = els.solutionMessage ? els.solutionMessage.offsetHeight : 0;
    const verticalPaddingBudget = 110;
    const bodyConstrained = Math.floor(
      solutionModalBody.clientHeight
      - draftBannerHeight
      - flagsSectionHeight
      - messageHeight
      - verticalPaddingBudget
    );
    if (Number.isFinite(bodyConstrained) && bodyConstrained > 0) {
      candidate = Math.min(candidate, bodyConstrained);
    }
  }

  const minimum = compactViewport ? 180 : 220;
  const maximum = compactViewport ? 420 : 520;
  return Math.max(minimum, Math.min(maximum, candidate));
}

function applySummernoteResponsiveHeight() {
  if (!state.admin.summernoteReady || !window.jQuery || typeof window.jQuery.fn?.summernote !== "function") {
    return;
  }

  const height = computeResponsiveSummernoteHeight();
  const editor = window.jQuery("#solutionEditor");
  if (!editor || !editor.length) {
    return;
  }

  try {
    editor.summernote("height", height);
  } catch (_error) {
    return;
  }

  const noteEditor = editor.siblings(".note-editor");
  if (noteEditor && noteEditor.length) {
    noteEditor.find(".note-editable").css("min-height", `${height}px`);
  }
}

function onSolutionModalShown() {
  applySummernoteResponsiveHeight();
}
function onWindowResize() {
  if (state.admin.open) {
    syncAdminResponsiveLayout({ preservePane: true });
  }

  applySummernoteResponsiveHeight();
}

function syncOverlayScrollLock() {
  const overlayOpen = Boolean(state.admin && state.admin.open)
    || Boolean(state.users && state.users.open);

  document.documentElement.classList.toggle("kbn-overlay-open", overlayOpen);
  document.body.classList.toggle("kbn-overlay-open", overlayOpen);
}

async function setAdminSelectionAndRender(nodeSelection, options = {}) {
  const autoSwitchCompactPane = options.autoSwitchCompactPane !== false;
  state.admin.selected = nodeSelection;
  renderAdminTree();
  await renderAdminSelection();

  if (autoSwitchCompactPane && state.admin.compactMode) {
    setAdminCompactPane("editor", { focus: true });
  }
}

async function openAdminOverlay() {
  if (!state.auth || !["admin", "superadmin"].includes(state.auth.role)) {
    showToast("Admin access required.", "danger");
    return;
  }

  els.adminOverlay.classList.remove("d-none");
  if (els.adminMySubmissionsBtn) {
    const hasAdminAccess = Boolean(state.auth && ["admin", "superadmin"].includes(state.auth.role));
    els.adminMySubmissionsBtn.classList.toggle("d-none", !hasAdminAccess);
    if (hasAdminAccess) {
      els.adminMySubmissionsBtn.textContent = state.auth && state.auth.canApprove
        ? "Change Approvals"
        : "My Submissions";
    }
  }
  activateOverlayFocusTrap(els.adminOverlay, closeAdminOverlay);
  state.admin.open = true;
  syncOverlayScrollLock();
  state.admin.compactPane = "tree";
  syncAdminResponsiveLayout({ preservePane: false });

  await loadAdminTree();
  selectAdminNodeClosest(state.selectedPaths[state.selectedPaths.length - 1] || "");
  renderAdminTree();
  await renderAdminSelection();
  // Always rehydrate integrity indicators when opening the admin overlay.
  // This avoids stale client state after auth/session transitions.
  await runAdminIntegrityScan({ force: false, announce: false });

  renderAdminIntegrityModal();
}

async function closeAdminOverlay() {
  if (!state.admin.open) {
    return;
  }

  if (state.admin.solutionPath) {
    state.admin.solutionCloseAllowed = true;
    state.modals.solution.hide();
  }

  els.adminOverlay.classList.add("d-none");
  if (state.modals.mySubmissions) {
    state.modals.mySubmissions.hide();
  }
  if (state.modals.submissionView) {
    state.modals.submissionView.hide();
  }
  deactivateOverlayFocusTrap(els.adminOverlay);
  state.admin.open = false;
  syncOverlayScrollLock();
  state.admin.compactPane = "tree";
  syncAdminResponsiveLayout({ preservePane: false });

  await loadTopics();
  state.selectedPaths = selectionsFromPathQuery();
  await rebuildFlow({ pushHistory: false, replaceHistory: true });
}

async function loadAdminTree() {
  const tree = await apiRequest("/api/admin/tree");
  if (!tree.ok) {
    showToast(tree.message || "Unable to load admin tree.", "danger");
    return;
  }

  state.admin.tree = tree;
  applyAdminIntegrityIssuesToTree();
}

function selectAdminNodeClosest(preferredPath) {
  const roots = adminRoots();
  const kbNodes = flattenNodes(roots.knowledgebaseRoot, "kb");

  const candidates = [preferredPath];
  let cursor = preferredPath;
  while (cursor.includes("/")) {
    cursor = cursor.substring(0, cursor.lastIndexOf("/"));
    candidates.push(cursor);
  }
  candidates.push("");

  for (const candidate of candidates) {
    const found = kbNodes.find((node) => node.path === candidate);
    if (found) {
      state.admin.selected = found;
      return;
    }
  }

  state.admin.selected = {
    scope: "kb-root",
    label: "Knowledgebase",
    path: "",
    type: "root"
  };
}

function isTrashTimestampBucketLabel(labelInput) {
  return /^\d{8}-\d{9}$/.test(String(labelInput || "").trim());
}

function isTopLevelTrashPath(pathInput) {
  const normalized = String(pathInput || "").trim();
  const segments = normalized.split("/").filter(Boolean);
  return segments.length === 3 && segments[0] === "_trash";
}

function getAvailableTopLevelTrashPaths() {
  const nodes = flattenNodes(adminRoots().trashRoot, "trash");
  return new Set(
    nodes
      .map((node) => String(node && node.path ? node.path : "").trim())
      .filter((nodePath) => isTopLevelTrashPath(nodePath))
  );
}

function pruneSelectedTrashPaths() {
  if (!state.admin.selectedTrashPaths || !state.admin.selectedTrashPaths.size) {
    return;
  }

  const available = getAvailableTopLevelTrashPaths();
  Array.from(state.admin.selectedTrashPaths).forEach((selectedPath) => {
    if (!available.has(selectedPath)) {
      state.admin.selectedTrashPaths.delete(selectedPath);
    }
  });
}

function pruneAdminMultiSelection() {
  const items = getAdminMultiSelectionItems();
  if (!items.length) {
    return;
  }

  const kbPaths = new Set(flattenNodes(adminRoots().knowledgebaseRoot, "kb").map((node) => node.path));
  const trashPaths = new Set(flattenNodes(adminRoots().trashRoot, "trash").map((node) => node.path));

  state.admin.multiSelectItems = items.filter((item) => {
    if (item.scope === "kb") {
      return kbPaths.has(item.path);
    }
    if (item.scope === "trash") {
      return trashPaths.has(item.path);
    }
    return false;
  });
}

function flattenTrashDisplayNodes(nodesInput) {
  const nodes = Array.isArray(nodesInput) ? nodesInput : [];
  const output = [];

  nodes.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (isTrashTimestampBucketLabel(node.label) && Array.isArray(node.children)) {
      output.push(...flattenTrashDisplayNodes(node.children));
      return;
    }

    output.push(node);
  });

  return output;
}

function renderAdminTree() {
  const roots = adminRoots();
  pruneSelectedTrashPaths();
  pruneAdminMultiSelection();
  ensureSelectedTreePathExpanded();
  els.adminKbTree.innerHTML = "";
  els.adminTrashTree.innerHTML = "";

  const kbRootBtn = treeButton(
    "Knowledgebase",
    state.admin.selected && state.admin.selected.scope === "kb-root",
    async () => {
      await setAdminSelectionAndRender({ scope: "kb-root", label: "Knowledgebase", path: "", type: "root" });
    }
  );
  els.adminKbTree.append(kbRootBtn);
  if (roots.knowledgebaseRoot && roots.knowledgebaseRoot.children) {
    els.adminKbTree.append(renderTreeList(roots.knowledgebaseRoot.children, "kb"));
  }

  const trashRootBtn = treeButton(
    "Trash",
    state.admin.selected && state.admin.selected.scope === "trash-root",
    async () => {
      await setAdminSelectionAndRender({ scope: "trash-root", label: "Trash", path: "_trash", type: "root" });
    }
  );
  els.adminTrashTree.append(trashRootBtn);
  if (roots.trashRoot && roots.trashRoot.children) {
    const trashDisplayNodes = flattenTrashDisplayNodes(roots.trashRoot.children);
    els.adminTrashTree.append(renderTreeList(trashDisplayNodes, "trash"));
  }
}

async function openAdminIntegrityModal() {
  if (state.modals.adminIntegrity) {
    state.modals.adminIntegrity.show();
  }

  renderAdminIntegrityModal();
  await runAdminIntegrityScan({ force: state.admin.integrity.stale, announce: false });
}

function setAdminIntegrityMessage(message, tone = "secondary") {
  if (!els.adminIntegrityMessage) {
    return;
  }

  const text = String(message || "").trim();
  if (!text) {
    els.adminIntegrityMessage.className = "small text-secondary";
    els.adminIntegrityMessage.textContent = "";
    return;
  }

  const level = ["danger", "warning", "success", "secondary", "info"].includes(tone) ? tone : "secondary";
  const classTone = level === "warning" ? "body-emphasis" : level;
  els.adminIntegrityMessage.className = `small text-${classTone}`;
  els.adminIntegrityMessage.textContent = text;
}

function markAdminIntegrityStale() {
  if (!state.admin || !state.admin.integrity) {
    return;
  }

  state.admin.integrity.stale = true;
}

function isDefaultQuestionTextForIntegrity(value) {
  return String(value || "").trim().toLowerCase() === INTEGRITY_DEFAULT_QUESTION_TEXT;
}

function isDefaultSolutionHtmlForIntegrity(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return INTEGRITY_DEFAULT_SOLUTION_HTML_VARIANTS.has(normalized);
}

function stripHtmlTextForIntegrity(value) {
  const html = String(value || "");
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const textContent = doc && doc.body && typeof doc.body.textContent === "string"
    ? doc.body.textContent
    : "";
  return String(textContent || "").replace(/\s+/g, " ").trim();
}

function hasAnyIntegrityIssue(issue) {
  if (!issue || typeof issue !== "object") {
    return false;
  }

  return Number(issue.brokenImageCount || 0) > 0
    || (Array.isArray(issue.unreachableReasons) && issue.unreachableReasons.length > 0)
    || Boolean(issue.defaultQuestion)
    || Boolean(issue.noAnswers)
    || Boolean(issue.defaultSolution)
    || Boolean(issue.mixedContent)
    || Boolean(issue.emptyQuestion)
    || Boolean(issue.emptySolution)
    || (Array.isArray(issue.caseCollisionSiblings) && issue.caseCollisionSiblings.length > 0);
}

function syncIntegritySummaryFromActiveIssues() {
  const summary = state.admin && state.admin.integrity ? state.admin.integrity.summary : null;
  if (!summary || typeof summary !== "object") {
    return;
  }

  summary.defaultQuestionTextNodes = Array.isArray(state.admin.integrity.defaultQuestionNodes)
    ? state.admin.integrity.defaultQuestionNodes.length
    : 0;
  summary.questionNodesWithoutAnswers = Array.isArray(state.admin.integrity.noAnswerNodes)
    ? state.admin.integrity.noAnswerNodes.length
    : 0;
  summary.defaultSolutionContentNodes = Array.isArray(state.admin.integrity.defaultSolutionNodes)
    ? state.admin.integrity.defaultSolutionNodes.length
    : 0;
  summary.mixedContentNodes = Array.isArray(state.admin.integrity.mixedContentNodes)
    ? state.admin.integrity.mixedContentNodes.length
    : 0;
  summary.emptyQuestionNodes = Array.isArray(state.admin.integrity.emptyQuestionNodes)
    ? state.admin.integrity.emptyQuestionNodes.length
    : 0;
  summary.emptySolutionNodes = Array.isArray(state.admin.integrity.emptySolutionNodes)
    ? state.admin.integrity.emptySolutionNodes.length
    : 0;
  summary.caseCollisionNodes = Array.isArray(state.admin.integrity.caseCollisionNodes)
    ? state.admin.integrity.caseCollisionNodes.length
    : 0;
}

function clearResolvedIntegrityIndicatorsForPath(pathInput, options = {}) {
  const pathValue = String(pathInput || "").trim();
  if (!pathValue || !state.admin || !state.admin.integrity) {
    return;
  }

  const shouldClearDefaultQuestion = Boolean(options.clearDefaultQuestion);
  const shouldClearNoAnswers = Boolean(options.clearNoAnswers);
  const shouldClearDefaultSolution = Boolean(options.clearDefaultSolution);
  const shouldClearEmptyQuestion = Boolean(options.clearEmptyQuestion);
  const shouldClearEmptySolution = Boolean(options.clearEmptySolution);
  if (!shouldClearDefaultQuestion && !shouldClearNoAnswers && !shouldClearDefaultSolution && !shouldClearEmptyQuestion && !shouldClearEmptySolution) {
    return;
  }

  let changed = false;

  const issueMap = state.admin.integrity.issuesByPath && typeof state.admin.integrity.issuesByPath === "object"
    ? state.admin.integrity.issuesByPath
    : {};

  const issue = Object.prototype.hasOwnProperty.call(issueMap, pathValue)
    ? issueMap[pathValue]
    : null;

  if (issue && typeof issue === "object") {
    if (shouldClearDefaultQuestion && issue.defaultQuestion) {
      issue.defaultQuestion = false;
      changed = true;
    }
    if (shouldClearNoAnswers && issue.noAnswers) {
      issue.noAnswers = false;
      changed = true;
    }
    if (shouldClearDefaultSolution && issue.defaultSolution) {
      issue.defaultSolution = false;
      changed = true;
    }
    if (shouldClearEmptyQuestion && issue.emptyQuestion) {
      issue.emptyQuestion = false;
      changed = true;
    }
    if (shouldClearEmptySolution && issue.emptySolution) {
      issue.emptySolution = false;
      changed = true;
    }

    if (!hasAnyIntegrityIssue(issue)) {
      delete issueMap[pathValue];
      changed = true;
    } else {
      issueMap[pathValue] = issue;
    }
  }

  if (shouldClearDefaultQuestion && Array.isArray(state.admin.integrity.defaultQuestionNodes)) {
    const before = state.admin.integrity.defaultQuestionNodes.length;
    state.admin.integrity.defaultQuestionNodes = state.admin.integrity.defaultQuestionNodes.filter((entry) => String(entry && entry.path ? entry.path : "") !== pathValue);
    changed = changed || before !== state.admin.integrity.defaultQuestionNodes.length;
  }

  if (shouldClearNoAnswers && Array.isArray(state.admin.integrity.noAnswerNodes)) {
    const before = state.admin.integrity.noAnswerNodes.length;
    state.admin.integrity.noAnswerNodes = state.admin.integrity.noAnswerNodes.filter((entry) => String(entry && entry.path ? entry.path : "") !== pathValue);
    changed = changed || before !== state.admin.integrity.noAnswerNodes.length;
  }

  if (shouldClearDefaultSolution && Array.isArray(state.admin.integrity.defaultSolutionNodes)) {
    const before = state.admin.integrity.defaultSolutionNodes.length;
    state.admin.integrity.defaultSolutionNodes = state.admin.integrity.defaultSolutionNodes.filter((entry) => String(entry && entry.path ? entry.path : "") !== pathValue);
    changed = changed || before !== state.admin.integrity.defaultSolutionNodes.length;
  }

  if (shouldClearEmptyQuestion && Array.isArray(state.admin.integrity.emptyQuestionNodes)) {
    const before = state.admin.integrity.emptyQuestionNodes.length;
    state.admin.integrity.emptyQuestionNodes = state.admin.integrity.emptyQuestionNodes.filter((entry) => String(entry && entry.path ? entry.path : "") !== pathValue);
    changed = changed || before !== state.admin.integrity.emptyQuestionNodes.length;
  }

  if (shouldClearEmptySolution && Array.isArray(state.admin.integrity.emptySolutionNodes)) {
    const before = state.admin.integrity.emptySolutionNodes.length;
    state.admin.integrity.emptySolutionNodes = state.admin.integrity.emptySolutionNodes.filter((entry) => String(entry && entry.path ? entry.path : "") !== pathValue);
    changed = changed || before !== state.admin.integrity.emptySolutionNodes.length;
  }

  if (!changed) {
    return;
  }

  state.admin.integrity.issuesByPath = issueMap;
  syncIntegritySummaryFromActiveIssues();
}

function applyAdminIntegrityIssuesToTree() {
  if (!state.admin || !state.admin.tree || !state.admin.tree.knowledgebaseRoot) {
    return;
  }

  const issuesByPath = state.admin.integrity && state.admin.integrity.issuesByPath
    ? state.admin.integrity.issuesByPath
    : {};

  const walk = (nodes) => {
    if (!Array.isArray(nodes)) {
      return;
    }

    nodes.forEach((node) => {
      if (!node || typeof node !== "object") {
        return;
      }

      const issue = node.path && Object.prototype.hasOwnProperty.call(issuesByPath, node.path)
        ? issuesByPath[node.path]
        : null;
      node.integrity = issue ? { ...issue } : null;

      if (Array.isArray(node.children)) {
        walk(node.children);
      }
    });
  };

  walk(state.admin.tree.knowledgebaseRoot.children);
}

function findAdminIntegrityIssue(pathInput) {
  const pathValue = String(pathInput || "").trim();
  if (!pathValue || !state.admin || !state.admin.integrity || !state.admin.integrity.issuesByPath) {
    return null;
  }

  return state.admin.integrity.issuesByPath[pathValue] || null;
}

function appendAdminIntegrityNotices(kbPath) {
  const issue = findAdminIntegrityIssue(kbPath);
  if (!issue) {
    return;
  }

  if (issue.defaultQuestion) {
    const defaultQuestion = document.createElement("div");
    defaultQuestion.className = "small text-danger";
    defaultQuestion.innerHTML = '<i class="bi bi-question-diamond me-1" aria-hidden="true"></i>Default question text is still unchanged.';
    els.adminPanelBody.append(defaultQuestion);
  }


  if (issue.noAnswers) {
    const noAnswers = document.createElement("div");
    noAnswers.className = "small text-danger";
    noAnswers.innerHTML = '<i class="bi bi-input-cursor-text me-1" aria-hidden="true"></i>No answers configured yet.';
    els.adminPanelBody.append(noAnswers);
  }

  if (issue.defaultSolution || issue.emptySolution) {
    const emptySolution = document.createElement("div");
    emptySolution.className = "small text-danger";
    emptySolution.innerHTML = '<i class="bi bi-body-text me-1" aria-hidden="true"></i>Solution is empty.';
    els.adminPanelBody.append(emptySolution);
  }

  if (issue.unreachableReasons && issue.unreachableReasons.length) {
    const unreachable = document.createElement("div");
    unreachable.className = "small text-danger";
    unreachable.innerHTML = '<i class="bi bi-sign-stop me-1" aria-hidden="true"></i>' + escapeHtml(issue.unreachableReasons.join(" "));
    els.adminPanelBody.append(unreachable);
  }

  if (Number(issue.brokenImageCount || 0) > 0) {
    const broken = document.createElement("div");
    broken.className = "small text-danger";
    const brokenLabel = String(issue.brokenImageCount) + " broken image reference" + (issue.brokenImageCount === 1 ? "" : "s") + ".";
    broken.innerHTML = '<i class="bi bi-image-fill me-1" aria-hidden="true"></i>' + escapeHtml(brokenLabel);
    els.adminPanelBody.append(broken);
  }

  if (issue.mixedContent) {
    const mixed = document.createElement("div");
    mixed.className = "small text-danger";
    mixed.innerHTML = '<i class="bi bi-exclamation-octagon me-1" aria-hidden="true"></i>Node contains both question.txt and solution.html.';
    els.adminPanelBody.append(mixed);
  }

  if (issue.emptyQuestion) {
    const emptyQuestion = document.createElement("div");
    emptyQuestion.className = "small text-danger";
    emptyQuestion.innerHTML = '<i class="bi bi-file-earmark-x me-1" aria-hidden="true"></i>Question file is empty or whitespace only.';
    els.adminPanelBody.append(emptyQuestion);
  }


  if (Array.isArray(issue.caseCollisionSiblings) && issue.caseCollisionSiblings.length) {
    const collision = document.createElement("div");
    collision.className = "small text-danger";
    const label = 'Case-collision siblings: ' + issue.caseCollisionSiblings.join(', ');
    collision.innerHTML = '<i class="bi bi-files me-1" aria-hidden="true"></i>' + escapeHtml(label);
    els.adminPanelBody.append(collision);
  }
}

function appendTreeIntegrityIndicators(container, integrityIssue) {
  if (!integrityIssue || typeof integrityIssue !== "object") {
    return;
  }

  const wrap = document.createElement("span");
  wrap.className = "kbn-tree-integrity-icons";

  const brokenCount = Number(integrityIssue.brokenImageCount || 0);
  if (brokenCount > 0) {
    const broken = document.createElement("span");
    broken.className = "kbn-tree-integrity-indicator text-danger";
    broken.innerHTML = '<i class="bi bi-image-fill" aria-hidden="true"></i>' + (brokenCount > 1 ? '<span class="kbn-tree-integrity-count">' + String(brokenCount) + '</span>' : '');
    broken.setAttribute("title", String(brokenCount) + " broken image reference" + (brokenCount === 1 ? "" : "s"));
    wrap.append(broken);
  }

  const unreachableReasons = Array.isArray(integrityIssue.unreachableReasons)
    ? integrityIssue.unreachableReasons.filter(Boolean)
    : [];
  if (unreachableReasons.length) {
    const unreachable = document.createElement("span");
    unreachable.className = "kbn-tree-integrity-indicator text-danger";
    unreachable.innerHTML = '<i class="bi bi-sign-stop" aria-hidden="true"></i>';
    unreachable.setAttribute("title", unreachableReasons.join(" "));
    wrap.append(unreachable);
  }

  const structuralWarnings = [];
  if (integrityIssue.mixedContent) {
    structuralWarnings.push("Contains both question.txt and solution.html");
  }
  if (integrityIssue.emptyQuestion) {
    structuralWarnings.push("Question file is empty");
  }
  if (Array.isArray(integrityIssue.caseCollisionSiblings) && integrityIssue.caseCollisionSiblings.length) {
    structuralWarnings.push("Case-collision siblings: " + integrityIssue.caseCollisionSiblings.join(", "));
  }
  if (structuralWarnings.length) {
    const structural = document.createElement("span");
    structural.className = "kbn-tree-integrity-indicator text-danger";
    structural.innerHTML = '<i class="bi bi-exclamation-diamond" aria-hidden="true"></i>';
    structural.setAttribute("title", structuralWarnings.join(" | "));
    wrap.append(structural);
  }

  if (!wrap.childNodes.length) {
    return;
  }

  container.append(wrap);
}

function normalizeIntegrityHistoryFoundAt(valueInput, fallbackInput = "") {
  const fallback = String(fallbackInput || new Date().toISOString());
  const value = String(valueInput || "").trim();
  if (!value) {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
}
function normalizeIntegrityHistoryPath(valueInput) {
  const raw = String(valueInput || "").trim().replace(/\\/g, "/");
  if (!raw) {
    return "";
  }

  const parts = raw
    .split("/")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  if (parts.some((entry) => entry === "." || entry === "..")) {
    return "";
  }

  return parts.join("/");
}


function normalizeAdminIntegrityHistoryRows(rowsInput) {
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const byPath = new Map();

  rows.forEach((entry) => {
    const pathValue = normalizeIntegrityHistoryPath(entry && entry.path ? entry.path : "");
    if (!pathValue) {
      return;
    }

    const normalized = {
      path: pathValue,
      issue: String(entry && entry.issue ? entry.issue : ""),
      detail: String(entry && entry.detail ? entry.detail : ""),
      missingImagePath: String(entry && entry.missingImagePath ? entry.missingImagePath : ""),
      foundAt: normalizeIntegrityHistoryFoundAt(entry && entry.foundAt ? entry.foundAt : "")
    };

    const existing = byPath.get(pathValue);
    if (!existing) {
      byPath.set(pathValue, normalized);
      return;
    }

    const existingTs = Date.parse(existing.foundAt);
    const normalizedTs = Date.parse(normalized.foundAt);
    if (!Number.isNaN(normalizedTs) && (Number.isNaN(existingTs) || normalizedTs >= existingTs)) {
      byPath.set(pathValue, normalized);
    }
  });

  return Array.from(byPath.values())
    .sort((a, b) => String(a.path || "").localeCompare(String(b.path || ""), undefined, { sensitivity: "base" }))
    .slice(0, INTEGRITY_HISTORY_MAX_ROWS);
}

function integrityHistoryRowSignature(entryInput) {
  const entry = entryInput && typeof entryInput === "object" ? entryInput : {};
  return JSON.stringify({
    issue: String(entry.issue || ""),
    detail: String(entry.detail || ""),
    missingImagePath: String(entry.missingImagePath || "")
  });
}

function buildAdminIntegrityRowsFromResult(result, foundAt) {
  const issueMap = result && result.issuesByPath && typeof result.issuesByPath === "object"
    ? result.issuesByPath
    : {};
  const found = normalizeIntegrityHistoryFoundAt(foundAt || "");
  const rows = [];

  Object.keys(issueMap)
    .sort((a, b) => String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" }))
    .forEach((pathValue) => {
      const issue = issueMap[pathValue] && typeof issueMap[pathValue] === "object" ? issueMap[pathValue] : {};
      const labels = [];
      const details = [];
      const missingImagePaths = [];

      const brokenImageCount = Number(issue.brokenImageCount || 0);
      if (brokenImageCount > 0) {
        labels.push("Broken image");
        const sources = Array.isArray(issue.brokenImageSources) ? issue.brokenImageSources : [];
        sources.forEach((source) => {
          const value = String(source || "").trim();
          if (value && !missingImagePaths.includes(value)) {
            missingImagePaths.push(value);
          }
        });
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
        return;
      }

      const issueTitle = labels.length === 1
        ? labels[0]
        : labels.join(", ");

      rows.push({
        path: pathValue,
        issue: issueTitle,
        detail: details.join(" | "),
        missingImagePath: missingImagePaths.join(" | "),
        foundAt: found
      });
    });

  return normalizeAdminIntegrityHistoryRows(rows);
}

function reconcileAdminIntegrityHistoryRows(existingRowsInput, currentRowsInput, foundAt) {
  const existingRows = normalizeAdminIntegrityHistoryRows(existingRowsInput);
  const currentRows = normalizeAdminIntegrityHistoryRows(currentRowsInput);
  const existingByPath = new Map(existingRows.map((entry) => [entry.path, entry]));
  const found = normalizeIntegrityHistoryFoundAt(foundAt || "");

  const merged = currentRows.map((entry) => {
    const previous = existingByPath.get(entry.path);
    const previousSignature = previous ? integrityHistoryRowSignature(previous) : "";
    const nextSignature = integrityHistoryRowSignature(entry);
    return {
      ...entry,
      foundAt: previous && previousSignature === nextSignature
        ? previous.foundAt
        : found
    };
  });

  return normalizeAdminIntegrityHistoryRows(merged);
}

function getAdminIntegrityHistoryRows() {
  const rows = Array.isArray(state.admin.integrity.historyRows)
    ? state.admin.integrity.historyRows.slice()
    : [];

  rows.sort((a, b) => {
    const byFoundAt = String(b.foundAt || "").localeCompare(String(a.foundAt || ""));
    if (byFoundAt !== 0) {
      return byFoundAt;
    }
    const byPath = String(a.path || "").localeCompare(String(b.path || ""), undefined, { sensitivity: "base" });
    if (byPath !== 0) {
      return byPath;
    }
    return String(a.issue || "").localeCompare(String(b.issue || ""), undefined, { sensitivity: "base" });
  });

  return rows;
}

function clearAllAdminIntegrityIndicators() {
  state.admin.integrity.issuesByPath = {};
  state.admin.integrity.stale = true;
  applyAdminIntegrityIssuesToTree();
  renderAdminTree();
  renderAdminSelection().catch(() => {});
  renderAdminIntegrityModal();
  setAdminIntegrityMessage("Integrity indicators cleared from tree view.", "info");
  showToast("Integrity indicators cleared.", "success");
}

function csvEscape(value) {
  const raw = String(value == null ? "" : value);
  if (raw.includes('"') || raw.includes(',') || raw.includes("\n") || raw.includes("\r")) {
    return '"' + raw.replace(/"/g, '""') + '"';
  }
  return raw;
}

function integrityCsvTimestamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return yyyy + mm + dd + "-" + hh + mi + ss;
}

function exportAdminIntegrityCsv() {
  const rows = getAdminIntegrityHistoryRows();
  if (!rows.length) {
    showToast("No integrity issues to export.", "warning");
    return;
  }

  const lines = ["path,issue,missing_image_path"];
  rows.forEach((entry) => {
    const missingImagePath = String(entry.missingImagePath || "");
    lines.push([
      csvEscape(entry.path || ""),
      csvEscape(entry.issue || ""),
      csvEscape(missingImagePath)
    ].join(","));
  });

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "admin-integrity-issues-" + integrityCsvTimestamp() + ".csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Integrity CSV exported.", "success");
}

async function clearAdminIntegrityHistory() {
  if (state.admin.integrity.running) {
    return;
  }

  const result = await apiRequest('/api/admin/integrity/history', {
    method: 'DELETE'
  });

  if (!result.ok) {
    const message = result.message || 'Unable to clear integrity history.';
    setAdminIntegrityMessage(message, 'danger');
    showToast(message, 'danger');
    return;
  }

  state.admin.integrity.generatedAt = '';
  state.admin.integrity.summary = null;
  state.admin.integrity.historyRows = [];
  state.admin.integrity.brokenImages = [];
  state.admin.integrity.unreachableNodes = [];
  state.admin.integrity.defaultQuestionNodes = [];
  state.admin.integrity.noAnswerNodes = [];
  state.admin.integrity.defaultSolutionNodes = [];
  state.admin.integrity.mixedContentNodes = [];
  state.admin.integrity.emptyQuestionNodes = [];
  state.admin.integrity.emptySolutionNodes = [];
  state.admin.integrity.caseCollisionNodes = [];
  state.admin.integrity.issuesByPath = {};
  state.admin.integrity.stale = false;

  applyAdminIntegrityIssuesToTree();
  renderAdminTree();
  await renderAdminSelection();
  renderAdminIntegrityModal();

  setAdminIntegrityMessage('Integrity scan history cleared.', 'info');
  showToast('Integrity scan history cleared.', 'success');
}

function countEmptySolutionIssueNodes(summaryInput, issuesByPathInput) {
  const summary = summaryInput && typeof summaryInput === "object" ? summaryInput : {};
  const issueMap = issuesByPathInput && typeof issuesByPathInput === "object" ? issuesByPathInput : null;

  if (issueMap) {
    const issues = Object.values(issueMap);
    if (issues.length) {
      return issues.reduce((count, issue) => {
        if (!issue || typeof issue !== "object") {
          return count;
        }
        return issue.defaultSolution || issue.emptySolution ? count + 1 : count;
      }, 0);
    }
  }

  const defaultCount = Number(summary.defaultSolutionContentNodes || 0);
  const emptyCount = Number(summary.emptySolutionNodes || 0);
  return Math.max(defaultCount, emptyCount);
}

async function runAdminIntegrityScan(options = {}) {
  if (state.admin.integrity.running) {
    return;
  }

  state.admin.integrity.running = true;
  if (els.adminIntegrityRescanBtn) {
    els.adminIntegrityRescanBtn.disabled = true;
  }
  if (els.adminIntegrityScanBtn) {
    els.adminIntegrityScanBtn.disabled = true;
  }
  if (els.adminIntegrityClearHistoryBtn) {
    els.adminIntegrityClearHistoryBtn.disabled = true;
  }

  setAdminIntegrityMessage("Running integrity scan...", "secondary");

  const force = options && options.force ? "true" : "false";
  const result = await apiRequest('/api/admin/integrity/scan?force=' + force);

  state.admin.integrity.running = false;
  if (els.adminIntegrityRescanBtn) {
    els.adminIntegrityRescanBtn.disabled = false;
  }
  if (els.adminIntegrityScanBtn) {
    els.adminIntegrityScanBtn.disabled = false;
  }
  if (els.adminIntegrityClearHistoryBtn) {
    els.adminIntegrityClearHistoryBtn.disabled = false;
  }

  if (!result.ok) {
    setAdminIntegrityMessage(result.message || "Integrity scan failed.", "danger");
    renderAdminIntegrityModal();
    return;
  }

  state.admin.integrity.generatedAt = String(result.generatedAt || new Date().toISOString());
  state.admin.integrity.summary = result.summary && typeof result.summary === "object" ? { ...result.summary } : null;
  state.admin.integrity.brokenImages = Array.isArray(result.brokenImages) ? result.brokenImages : [];
  state.admin.integrity.unreachableNodes = Array.isArray(result.unreachableNodes) ? result.unreachableNodes : [];
  state.admin.integrity.defaultQuestionNodes = Array.isArray(result.defaultQuestionNodes) ? result.defaultQuestionNodes : [];
  state.admin.integrity.noAnswerNodes = Array.isArray(result.noAnswerNodes) ? result.noAnswerNodes : [];
  state.admin.integrity.defaultSolutionNodes = Array.isArray(result.defaultSolutionNodes) ? result.defaultSolutionNodes : [];
  state.admin.integrity.mixedContentNodes = Array.isArray(result.mixedContentNodes) ? result.mixedContentNodes : [];
  state.admin.integrity.emptyQuestionNodes = Array.isArray(result.emptyQuestionNodes) ? result.emptyQuestionNodes : [];
  state.admin.integrity.emptySolutionNodes = Array.isArray(result.emptySolutionNodes) ? result.emptySolutionNodes : [];
  state.admin.integrity.caseCollisionNodes = Array.isArray(result.caseCollisionNodes) ? result.caseCollisionNodes : [];
  state.admin.integrity.issuesByPath = result.issuesByPath && typeof result.issuesByPath === "object" ? result.issuesByPath : {};
  state.admin.integrity.stale = false;

  if (Array.isArray(result.historyRows)) {
    state.admin.integrity.historyRows = normalizeAdminIntegrityHistoryRows(
      result.historyRows.map((entry) => ({
        path: String(entry && entry.path ? entry.path : ""),
        issue: String(entry && entry.issue ? entry.issue : ""),
        detail: String(entry && entry.detail ? entry.detail : ""),
        missingImagePath: String(entry && entry.missingImagePath ? entry.missingImagePath : ""),
        foundAt: String(entry && entry.foundAt ? entry.foundAt : state.admin.integrity.generatedAt)
      }))
    );
  } else {
    state.admin.integrity.historyRows = reconcileAdminIntegrityHistoryRows(
      state.admin.integrity.historyRows,
      buildAdminIntegrityRowsFromResult(result, state.admin.integrity.generatedAt),
      state.admin.integrity.generatedAt
    );
  }

  applyAdminIntegrityIssuesToTree();
  renderAdminTree();
  await renderAdminSelection();
  renderAdminIntegrityModal();

  const summary = state.admin.integrity.summary || {};
  const emptySolutionIssueCount = countEmptySolutionIssueNodes(summary, state.admin.integrity.issuesByPath);
  const issueCount = Number(summary.brokenImageRefs || 0)
    + Number(summary.unreachableNodes || 0)
    + Number(summary.defaultQuestionTextNodes || 0)
    + Number(summary.questionNodesWithoutAnswers || 0)
    + Number(summary.mixedContentNodes || 0)
    + Number(summary.emptyQuestionNodes || 0)
    + Number(emptySolutionIssueCount || 0)
    + Number(summary.caseCollisionNodes || 0);
  if (issueCount === 0) {
    setAdminIntegrityMessage("Integrity scan complete. No issues found.", "success");
  } else {
    setAdminIntegrityMessage("Integrity scan complete. " + String(issueCount) + " issue" + (issueCount === 1 ? "" : "s") + " found.", "warning");
  }

  if (options && options.announce) {
    showToast("Integrity scan complete.", "success");
  }
}

function renderAdminIntegrityModal() {
  if (!els.adminIntegritySummary || !els.adminIntegrityRows) {
    return;
  }

  const summary = state.admin.integrity.summary || null;
  if (!summary) {
    els.adminIntegritySummary.textContent = "No scan results yet.";
  } else {
    const generated = state.admin.integrity.generatedAt ? formatDateTime(state.admin.integrity.generatedAt) : "-";
    const staleText = state.admin.integrity.stale ? " (stale after recent edits)" : "";

    const primaryMetrics = [
      { label: "Scanned", value: Number(summary.scannedNodes || 0), tone: "secondary" },
      { label: "Broken Images", value: Number(summary.brokenImageRefs || 0), tone: Number(summary.brokenImageRefs || 0) > 0 ? "danger" : "success" },
      { label: "Unreachable", value: Number(summary.unreachableNodes || 0), tone: Number(summary.unreachableNodes || 0) > 0 ? "warning" : "success" }
    ];

    const emptySolutionIssueCount = countEmptySolutionIssueNodes(summary, state.admin.integrity.issuesByPath);

    const detailMetrics = [
      { label: "Default Questions", value: Number(summary.defaultQuestionTextNodes || 0) },
      { label: "No-Answer Nodes", value: Number(summary.questionNodesWithoutAnswers || 0) },
      { label: "Mixed Content", value: Number(summary.mixedContentNodes || 0) },
      { label: "Empty Questions", value: Number(summary.emptyQuestionNodes || 0) },
      { label: "Empty Solutions", value: Number(emptySolutionIssueCount || 0) },
      { label: "Case Collisions", value: Number(summary.caseCollisionNodes || 0) }
    ];

    const renderBadge = (metric) => {
      const tone = metric.tone ? String(metric.tone) : (Number(metric.value || 0) > 0 ? "warning" : "secondary");
      const classes = tone === "danger"
        ? "text-bg-danger"
        : tone === "success"
          ? "text-bg-success"
          : tone === "warning"
            ? "text-bg-warning"
            : "text-bg-secondary";
      return '<span class="badge ' + classes + ' me-1 mb-1">' + escapeHtml(metric.label + ': ' + String(metric.value)) + '</span>';
    };

    els.adminIntegritySummary.innerHTML = '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">'
      + '<div class="small fw-semibold">Latest Scan Summary</div>'
      + '<div class="small text-secondary">Generated: ' + escapeHtml(generated + staleText) + '</div>'
      + '</div>'
      + '<div class="mt-2">' + primaryMetrics.map(renderBadge).join('') + '</div>'
      + '<div class="mt-1">' + detailMetrics.map(renderBadge).join('') + '</div>';
  }

  const rows = getAdminIntegrityHistoryRows();

  els.adminIntegrityRows.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("tr");
    empty.innerHTML = '<td colspan="3" class="text-secondary small">No integrity issues detected in scan history.</td>';
    els.adminIntegrityRows.append(empty);
    return;
  }

  rows.forEach((entry) => {
    const row = document.createElement("tr");
    const issueTitleParts = [];
    if (entry.detail) {
      issueTitleParts.push(entry.detail);
    }
    if (entry.missingImagePath) {
      issueTitleParts.push("Missing image: " + entry.missingImagePath);
    }
    const issueTitle = issueTitleParts.join(" | ");
    const foundAtText = entry.foundAt ? formatDateTime(entry.foundAt) : "-";
    const issueTitleAttr = issueTitle ? ' title="' + escapeHtml(issueTitle) + '"' : "";
    row.innerHTML = '<td class="small text-break">' + escapeHtml(entry.path || '-') + '</td>'
      + '<td class="small text-nowrap"' + issueTitleAttr + '>' + escapeHtml(entry.issue || '-') + '</td>'
      + '<td class="small text-nowrap">' + escapeHtml(foundAtText) + '</td>';
    els.adminIntegrityRows.append(row);
  });
}

function renderTreeList(nodes, scope) {
  const ul = document.createElement("ul");
  ul.className = "tree-list";

  nodes.forEach((node) => {
    const li = document.createElement("li");
    li.className = "tree-item";

    const selected = isTreeNodeSelected(node, scope) || isTreeNodeMultiSelected(node, scope);
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const collapsed = hasChildren ? isTreeNodeCollapsed(node, scope) : false;
    const label = String(node.label || "");
    const decorators = node.type === "terminal"
      ? optionSelectorFlags({ terminal: true, flags: Array.isArray(node.flags) ? node.flags : [] })
      : [];
    const labelColorClass = node.type === "terminal" ? "kbn-tree-solution-label" : "kbn-tree-question-label";

    const row = document.createElement("div");
    row.className = "tree-item-row";

    if (hasChildren) {
      const toggle = treeToggleButton(!collapsed, label, () => {
        const key = treePathKey(scope, node.path);
        if (state.admin.collapsedTreeKeys.has(key)) {
          state.admin.collapsedTreeKeys.delete(key);
        } else {
          state.admin.collapsedTreeKeys.add(key);
        }
        renderAdminTree();
      });
      row.append(toggle);
    } else {
      row.append(treeToggleSpacer());
    }
    if (scope === "trash" && isTopLevelTrashPath(node.path)) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input kbn-trash-select-checkbox";
      checkbox.checked = state.admin.selectedTrashPaths.has(node.path);
      checkbox.title = `Select ${label} for bulk restore/purge`;
      checkbox.setAttribute("aria-label", `Select ${label} for bulk restore or purge`);
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.admin.selectedTrashPaths.add(node.path);
        } else {
          state.admin.selectedTrashPaths.delete(node.path);
        }
        renderAdminTree();
        renderAdminSelection().catch(() => {});
      });
      row.append(checkbox);
    }

    const buttonContent = buildTreeNodeLabel(
      label,
      decorators,
      labelColorClass,
      node.type,
      node.questionText || "",
      node.integrity || null
    );

    const btn = treeButton(label, selected, async (event) => {
      const isModifier = Boolean(event && (event.ctrlKey || event.metaKey));
      const nodeSelection = { ...node, scope };

      if (isModifier) {
        const multiResult = toggleAdminMultiSelection(nodeSelection);
        if (!multiResult.ok && multiResult.message) {
          showToast(multiResult.message, "warning");
        }

        renderAdminTree();
        await renderAdminSelection();
        return;
      }

      clearAdminMultiSelection();
      await setAdminSelectionAndRender(nodeSelection);
    }, { content: buttonContent });

    row.append(btn);
    li.append(row);

    if (hasChildren && !collapsed) {
      li.append(renderTreeList(node.children, scope));
    }

    ul.append(li);
  });

  return ul;
}

function buildTreeNodeLabel(
  label,
  decorators,
  labelColorClass = "",
  nodeType = "",
  questionText = "",
  integrityIssue = null
) {
  const content = document.createDocumentFragment();

  const typePrefix = document.createElement("span");
  typePrefix.className = "visually-hidden";
  typePrefix.textContent = nodeType === "terminal" ? "Solution: " : "Question: ";
  content.append(typePrefix);

  const typeIcon = document.createElement("i");
  typeIcon.className = `bi ${nodeType === "terminal" ? "bi-file-earmark-check" : "bi-diagram-3"} kbn-tree-type-icon`;
  typeIcon.setAttribute("aria-hidden", "true");
  content.append(typeIcon);

  const labelWrap = document.createElement("span");
  labelWrap.className = "kbn-tree-label-wrap";

  const text = document.createElement("span");
  text.className = "kbn-tree-label";
  const safeColorClass = String(labelColorClass || "").trim();
  if (safeColorClass) {
    text.classList.add(safeColorClass);
  }
  text.textContent = label;
  labelWrap.append(text);

  const shouldShowQuestionSubline = nodeType === "node"
    && normalizeTreeUnderline(state.uiSettings.showQuestionTextInTree, DEFAULT_SHOW_QUESTION_TEXT_IN_TREE);
  const normalizedQuestionText = String(questionText || "").replace(/\s+/g, " ").trim();
  if (shouldShowQuestionSubline && normalizedQuestionText) {
    const subline = document.createElement("span");
    subline.className = "kbn-tree-question-subline";
    subline.textContent = normalizedQuestionText;
    labelWrap.append(subline);
  }

  content.append(labelWrap);

  const hasDefaultQuestionIssue = Boolean(integrityIssue && integrityIssue.defaultQuestion);
  const hasDefaultSolutionIssue = Boolean(integrityIssue && integrityIssue.defaultSolution);
  const hasEmptySolutionIssue = Boolean(integrityIssue && integrityIssue.emptySolution);
  const hasNoAnswersIssue = Boolean(integrityIssue && integrityIssue.noAnswers);

  if ((nodeType === "node" && hasDefaultQuestionIssue) || (nodeType === "terminal" && (hasDefaultSolutionIssue || hasEmptySolutionIssue))) {
    const defaultMarker = document.createElement("span");
    defaultMarker.className = "kbn-tree-default-indicator text-danger";
    defaultMarker.innerHTML = `<i class="bi ${nodeType === "terminal" ? "bi-body-text" : "bi-question-diamond"}" aria-hidden="true"></i>`;
    defaultMarker.setAttribute("title", nodeType === "terminal" ? "Solution is empty" : "Default question text");

    const srOnly = document.createElement("span");
    srOnly.className = "visually-hidden";
    srOnly.textContent = nodeType === "terminal"
      ? " Solution is empty."
      : " Default question text not updated.";
    defaultMarker.append(srOnly);
    content.append(defaultMarker);
  }

  if (nodeType === "node" && hasNoAnswersIssue) {
    const emptyAnswersMarker = document.createElement("span");
    emptyAnswersMarker.className = "kbn-tree-empty-indicator text-danger";
    emptyAnswersMarker.innerHTML = '<i class="bi bi-input-cursor-text" aria-hidden="true"></i>';
    emptyAnswersMarker.setAttribute("title", "No answers configured yet");

    const srOnly = document.createElement("span");
    srOnly.className = "visually-hidden";
    srOnly.textContent = " Question has no answers configured yet.";
    emptyAnswersMarker.append(srOnly);
    content.append(emptyAnswersMarker);
  }

  appendTreeFlagIcons(content, decorators);
  appendTreeIntegrityIndicators(content, integrityIssue);
  return content;
}

function appendTreeFlagIcons(container, decorators) {
  if (!Array.isArray(decorators) || !decorators.length) {
    return;
  }

  const maxIcons = 3;
  const visible = decorators.slice(0, maxIcons);
  const hiddenCount = decorators.length - visible.length;

  const iconWrap = document.createElement("span");
  iconWrap.className = "kbn-step-option-icons ms-2";

  visible.forEach((decorator) => {
    const icon = document.createElement("i");
    icon.className = `bi ${decorator.iconClass} kbn-step-option-icon`;
    icon.setAttribute("aria-hidden", "true");

    const colorMeta = flagColorMeta(decorator.colorClass || "", "", decorator.backgroundColor || "");

    const chip = document.createElement("span");
    chip.className = "kbn-tree-flag-chip";
    if (colorMeta.className) {
      chip.classList.add(colorMeta.className);
    }
    if (colorMeta.needsChip) {
      chip.classList.add("kbn-flag-chip");
    }
    if (colorMeta.styleColor) {
      chip.style.color = colorMeta.styleColor;
    }
    if (colorMeta.needsChip && colorMeta.chipBackground) {
      chip.style.backgroundColor = colorMeta.chipBackground;
    }

    const titleParts = [];
    if (decorator.name) {
      titleParts.push(decorator.name);
    }
    if (decorator.message) {
      titleParts.push(decorator.message);
    }
    chip.setAttribute("title", titleParts.join(": ") || "Flag");

    chip.append(icon);
    iconWrap.append(chip);
  });

  if (hiddenCount > 0) {
    const more = document.createElement("span");
    more.className = "kbn-step-option-more text-secondary";
    more.textContent = `+${hiddenCount}`;
    more.setAttribute("title", `${hiddenCount} more flag${hiddenCount === 1 ? "" : "s"}`);
    iconWrap.append(more);
  }

  appendFlagScreenReaderText(iconWrap, decorators);

  container.append(iconWrap);
}

function treeButton(label, isActive, onClick, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tree-button ${isActive ? "active" : ""}`;
  if (isActive) {
    button.setAttribute("aria-current", "true");
  }

  if (options && options.content) {
    button.append(options.content);
  } else {
    button.textContent = label;
  }

  button.addEventListener("click", (event) => onClick(event));
  return button;
}

function treeToggleButton(expanded, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree-toggle";
  button.title = `${expanded ? "Collapse" : "Expand"} ${label}`;
  button.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${label}`);
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
  button.innerHTML = `<i class="bi ${expanded ? "bi-caret-down-fill" : "bi-caret-right-fill"}" aria-hidden="true"></i>`;
  button.addEventListener("click", onClick);
  return button;
}

function treeToggleSpacer() {
  const spacer = document.createElement("span");
  spacer.className = "tree-toggle-spacer";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

function treePathKey(scope, pathValue) {
  return `${scope}:${String(pathValue || "")}`;
}

function isTreeNodeCollapsed(node, scope) {
  return state.admin.collapsedTreeKeys.has(treePathKey(scope, node.path));
}

function setAllTreeNodesCollapsed(collapsed) {
  const keys = [];
  const roots = adminRoots();
  collectCollapsibleTreeKeys(roots.knowledgebaseRoot && roots.knowledgebaseRoot.children, "kb", keys);
  collectCollapsibleTreeKeys(roots.trashRoot && roots.trashRoot.children, "trash", keys);

  if (!collapsed) {
    state.admin.collapsedTreeKeys.clear();
    return;
  }

  state.admin.collapsedTreeKeys = new Set(keys);
}

function collectCollapsibleTreeKeys(nodes, scope, output) {
  if (!Array.isArray(nodes)) {
    return;
  }

  nodes.forEach((node) => {
    if (Array.isArray(node.children) && node.children.length > 0) {
      output.push(treePathKey(scope, node.path));
      collectCollapsibleTreeKeys(node.children, scope, output);
    }
  });
}

function ensureSelectedTreePathExpanded() {
  const selected = state.admin.selected;
  if (!selected || !selected.path || !["kb", "trash"].includes(selected.scope)) {
    return;
  }

  const segments = String(selected.path).split("/").filter(Boolean);
  if (!segments.length) {
    return;
  }

  let cursor = "";
  for (let i = 0; i < segments.length - 1; i += 1) {
    cursor = cursor ? `${cursor}/${segments[i]}` : segments[i];
    state.admin.collapsedTreeKeys.delete(treePathKey(selected.scope, cursor));
  }
}

function isTreeNodeSelected(node, scope) {
  if (!state.admin.selected) {
    return false;
  }
  return state.admin.selected.scope === scope && state.admin.selected.path === node.path;
}

function getAdminMultiSelectionItems() {
  return Array.isArray(state.admin.multiSelectItems)
    ? state.admin.multiSelectItems
      .filter((item) => item && item.path && item.scope)
    : [];
}

function isTreeNodeMultiSelected(node, scope) {
  return getAdminMultiSelectionItems().some((item) => item.scope === scope && item.path === node.path);
}

function clearAdminMultiSelection() {
  const previous = getAdminMultiSelectionItems();
  previous.forEach((item) => {
    if (item.scope === "trash" && isTopLevelTrashPath(item.path)) {
      state.admin.selectedTrashPaths.delete(item.path);
    }
  });
  state.admin.multiSelectItems = [];
}

function toggleAdminMultiSelection(nodeSelection) {
  if (!nodeSelection || !nodeSelection.path || !nodeSelection.scope) {
    return { ok: false, message: "Invalid selection." };
  }

  const scope = nodeSelection.scope;
  if (!["kb", "trash"].includes(scope)) {
    return { ok: false, message: "Unsupported selection scope." };
  }

  const current = getAdminMultiSelectionItems();
  if (current.length && current[0].scope !== scope) {
    return {
      ok: false,
      message: "Cannot multi-select across Knowledgebase and Trash at the same time."
    };
  }

  const next = [...current];
  const existingIndex = next.findIndex((item) => item.scope === scope && item.path === nodeSelection.path);
  if (existingIndex >= 0) {
    next.splice(existingIndex, 1);
  } else {
    next.push({
      scope,
      path: nodeSelection.path,
      label: nodeSelection.label,
      type: nodeSelection.type
    });
  }

  state.admin.multiSelectItems = next;

  if (scope === "trash" && isTopLevelTrashPath(nodeSelection.path)) {
    const exists = next.some((item) => item.scope === "trash" && item.path === nodeSelection.path);
    if (exists) {
      state.admin.selectedTrashPaths.add(nodeSelection.path);
    } else {
      state.admin.selectedTrashPaths.delete(nodeSelection.path);
    }
  }

  if (next.length === 0) {
    state.admin.selected = null;
  } else {
    state.admin.selected = { ...next[next.length - 1] };
  }

  return { ok: true };
}

async function renderAdminSelection() {
  const selected = state.admin.selected;
  els.adminActionBar.innerHTML = "";
  els.adminPanelBody.innerHTML = "";
  els.adminSelectionTitle.textContent = selected ? selected.label : "Select an item";
  els.adminSelectionSub.textContent = selected ? selected.path || "/" : "";

  if (!selected) {
    return;
  }

  const multiItems = getAdminMultiSelectionItems();
  if (multiItems.length > 1) {
    renderAdminMultiSelectionPanel(multiItems);
    return;
  }

  if (selected.scope === "kb-root") {
    els.adminSelectionTitle.textContent = "Knowledgebase";
    els.adminSelectionSub.textContent = "Root";
    els.adminActionBar.append(
      buildButton("Create Topic", "btn-primary btn-sm", () => {
        openCreateTopicModal();
      })
    );
    els.adminPanelBody.textContent = "Create top-level topic folders from here.";
    return;
  }

  if (selected.scope === "trash-root") {
    renderTrashRootPanel();
    return;
  }

  if (selected.scope === "trash") {
    renderTrashItemPanel(selected);
    return;
  }

  if (selected.scope === "kb" && selected.type === "node") {
    await renderNodePanel(selected);
    return;
  }

  if (selected.scope === "kb" && selected.type === "terminal") {
    await renderTerminalPanel(selected);
  }
}

function renderAdminMultiSelectionPanel(itemsInput) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (items.length < 2) {
    return;
  }

  const scope = items[0].scope;
  els.adminSelectionTitle.textContent = `${items.length} Items Selected`;
  els.adminSelectionSub.textContent = scope === "trash" ? "Trash" : "Knowledgebase";

  els.adminActionBar.append(
    buildButton("Deselect All", "btn-outline-secondary btn-sm", async () => {
      clearAdminMultiSelection();
      renderAdminTree();
      await renderAdminSelection();
    })
  );

  if (scope === "trash") {
    const trashPaths = items.map((item) => item.path).filter(Boolean);
    els.adminActionBar.append(
      buildButton("Restore Selected", "btn-outline-primary btn-sm", () => openRestoreModal(trashPaths)),
      buildButton("Purge Selected", "btn-outline-danger btn-sm", () => purgeSelectedTrashItems(trashPaths))
    );
    els.adminPanelBody.textContent = "Bulk trash mode: restore or purge selected trash items.";
    return;
  }

  els.adminActionBar.append(
    buildButton("Delete Selected", "btn-outline-danger btn-sm", () => {
      onDeleteAdminMultiSelection(items).catch(() => {});
    })
  );

  const allNodes = items.every((item) => item.type === "node");
  const allTerminals = items.every((item) => item.type === "terminal");
  if (allNodes || allTerminals) {
    const label = allNodes ? "Convert Selected to Solution" : "Convert Selected to Node";
    els.adminActionBar.append(
      buildButton(label, "btn-outline-warning btn-sm", () => {
        onConvertAdminMultiSelection(items).catch(() => {});
      })
    );
  }

  els.adminPanelBody.textContent = "Bulk edit mode: only bulk actions are shown for the selected items.";
}

async function onDeleteAdminMultiSelection(itemsInput) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (!items.length) {
    return;
  }

  const confirmed = window.confirm(`Delete ${items.length} selected item(s)? They will be moved to trash.`);
  if (!confirmed) {
    return;
  }

  const payloadItems = items
    .map((item) => {
      if (!item || !item.path || item.scope !== "kb") {
        return null;
      }

      if (item.type === "node") {
        return { type: "question", path: item.path };
      }
      if (item.type === "terminal") {
        return { type: "solution", path: item.path };
      }
      return null;
    })
    .filter(Boolean);

  if (!payloadItems.length) {
    showToast("No valid items selected for delete.", "warning");
    return;
  }

  const result = await apiRequest("/api/admin/batch-delete", {
    method: "POST",
    body: JSON.stringify({ items: payloadItems })
  });

  const deletedCount = Number(result.deletedCount || 0);
  const failedCount = Number(result.failedCount || 0);

  if (!result.ok && deletedCount === 0) {
    showToast(result.message || "Bulk delete failed.", "danger");
    return;
  }

  clearAdminMultiSelection();
  const tone = failedCount > 0 ? "warning" : "success";
  showToast(`Bulk delete complete: ${deletedCount} deleted, ${failedCount} failed.`, tone);
  await reloadAdminTreePreserveSelection("");
}

async function onConvertAdminMultiSelection(itemsInput) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  if (!items.length) {
    return;
  }

  const allNodes = items.every((item) => item.type === "node");
  const allTerminals = items.every((item) => item.type === "terminal");
  if (!allNodes && !allTerminals) {
    showToast("Mixed selections cannot be converted.", "warning");
    return;
  }

  const mode = allNodes ? "question-to-solution" : "solution-to-question";
  let questionText = "New question";
  if (mode === "solution-to-question") {
    questionText = window.prompt("Question text to apply to converted nodes:", "New question") || "New question";
  }

  const confirmed = window.confirm(`Convert ${items.length} selected item(s)?`);
  if (!confirmed) {
    return;
  }

  const paths = items.map((item) => item.path).filter(Boolean);
  const result = await apiRequest("/api/admin/batch-convert", {
    method: "POST",
    body: JSON.stringify({ mode, paths, questionText })
  });

  const convertedCount = Number(result.convertedCount || 0);
  const failedCount = Number(result.failedCount || 0);

  if (!result.ok && convertedCount === 0) {
    showToast(result.message || "Bulk convert failed.", "danger");
    return;
  }

  clearAdminMultiSelection();
  const tone = failedCount > 0 ? "warning" : "success";
  showToast(`Bulk convert complete: ${convertedCount} converted, ${failedCount} failed.`, tone);
  await reloadAdminTreePreserveSelection(paths[0] || "");
}

function renderTrashRootPanel() {
  els.adminSelectionTitle.textContent = "Trash";
  els.adminSelectionSub.textContent = "_trash";

  const selectedPaths = Array.from(state.admin.selectedTrashPaths || []);
  if (selectedPaths.length) {
    els.adminActionBar.append(
      buildButton("Restore Selected", "btn-outline-primary btn-sm", () => openRestoreModal(selectedPaths)),
      buildButton("Purge Selected", "btn-outline-danger btn-sm", () => purgeSelectedTrashItems(selectedPaths))
    );
  }

  const message = selectedPaths.length
    ? `${selectedPaths.length} top-level trash item${selectedPaths.length === 1 ? "" : "s"} selected.`
    : "Select one or more top-level trash items using checkboxes, then restore or purge.";
  els.adminPanelBody.textContent = message;
}

function renderTrashItemPanel(selected) {
  const selectedPaths = Array.from(state.admin.selectedTrashPaths || []);

  els.adminActionBar.append(
    buildButton("Restore", "btn-outline-primary btn-sm", () => openRestoreModal([selected.path])),
    buildButton("Purge", "btn-outline-danger btn-sm", () => purgeTrashItem(selected.path))
  );

  if (selectedPaths.length) {
    els.adminActionBar.append(
      buildButton("Restore Selected", "btn-outline-primary btn-sm", () => openRestoreModal(selectedPaths)),
      buildButton("Purge Selected", "btn-outline-danger btn-sm", () => purgeSelectedTrashItems(selectedPaths))
    );
  }

  appendKeyValue(els.adminPanelBody, "Trash Path", selected.path);
  appendKeyValue(els.adminPanelBody, "Type", "Trash item");
  if (selectedPaths.length) {
    appendKeyValue(
      els.adminPanelBody,
      "Bulk Selection",
      `${selectedPaths.length} top-level item${selectedPaths.length === 1 ? "" : "s"} selected`
    );
  }
}

async function renderNodePanel(selected) {
  els.adminActionBar.append(
    buildButton("Edit Question", "btn-primary btn-sm", () => openQuestionEditor(selected.path)),
    buildButton("Add Answer", "btn-outline-primary btn-sm", () => openAddAnswerModal(selected.path)),
    buildButton("Rename", "btn-outline-secondary btn-sm", () => openRenameModal(selected.path)),
    buildButton("Move", "btn-outline-secondary btn-sm", () => openMoveQuestionModal(selected.path)),
    buildButton("Delete", "btn-outline-danger btn-sm", () => deleteKbPath(selected.path)),
    buildButton("Convert to Solution", "btn-outline-warning btn-sm", () => convertNodeToSolution(selected.path))
  );

  const question = await apiRequest(`/api/admin/question?path=${encodeURIComponent(selected.path)}`);
  appendKeyValue(els.adminPanelBody, "Path", selected.path);
  appendKeyValue(els.adminPanelBody, "Type", "Question node");

  appendAdminIntegrityNotices(selected.path);

  const preview = document.createElement("div");
  preview.className = "mt-2";
  preview.innerHTML = `<div class="fw-semibold mb-1">Question Preview</div><pre class="small border rounded p-2 mb-0 kbn-admin-question-preview">${escapeHtml(
    question.ok ? question.question : "Unavailable"
  )}</pre>`;
  els.adminPanelBody.append(preview);

  await renderVersionHistoryPanel(selected.path);
}

async function renderTerminalPanel(selected) {
  els.adminActionBar.append(
    buildButton("Edit Solution", "btn-primary btn-sm", () => openSolutionEditor(selected.path)),
    buildButton("View Solution", "btn-outline-primary btn-sm", () => viewSolutionPreview(selected.path)),
    buildButton("Rename", "btn-outline-secondary btn-sm", () => openRenameModal(selected.path)),
    buildButton("Delete", "btn-outline-danger btn-sm", () => deleteKbPath(selected.path)),
    buildButton("Convert to Node", "btn-outline-warning btn-sm", () => convertSolutionToNode(selected.path))
  );

  const preview = await apiRequest(`/api/admin/solution/view?path=${encodeURIComponent(selected.path)}`);
  appendKeyValue(els.adminPanelBody, "Path", selected.path);
  appendKeyValue(els.adminPanelBody, "Type", "Terminal solution");

  appendAdminIntegrityNotices(selected.path);

  if (!preview.ok) {
    const p = document.createElement("div");
    p.className = "text-danger";
    p.textContent = preview.message || "Unable to load solution preview.";
    els.adminPanelBody.append(p);
    return;
  }

  renderAppliedFlagsPanel(preview.flags || []);

  const previewBox = document.createElement("div");
  previewBox.className = "border rounded p-2 mt-2";
  previewBox.innerHTML = `<div class="fw-semibold mb-2">Solution Preview</div>${preview.solutionHtml || "<em>No content</em>"}`;
  els.adminPanelBody.append(previewBox);

  await renderSolutionDraftPanel(selected.path);
  await renderVersionHistoryPanel(selected.path);
}

async function renderSolutionDraftPanel(kbPath) {
  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-2 mt-2";

  const title = document.createElement("div");
  title.className = "fw-semibold mb-2";
  title.textContent = "Latest Draft";
  wrapper.append(title);

  const result = await apiRequest(`/api/admin/solution/draft?path=${encodeURIComponent(kbPath)}`);
  if (!result.ok) {
    const error = document.createElement("div");
    error.className = "small text-secondary";
    error.textContent = result.message || "Draft status unavailable.";
    wrapper.append(error);
    els.adminPanelBody.append(wrapper);
    return;
  }

  if (!result.draftExists || !result.draft) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary";
    empty.textContent = "No draft saved.";
    wrapper.append(empty);
    els.adminPanelBody.append(wrapper);
    return;
  }

  const details = document.createElement("div");
  details.className = "small text-secondary";
  details.textContent = `Saved by ${result.draft.owner || "unknown"} at ${formatDateTime(result.draft.updatedAt)}.`;

  const actions = document.createElement("div");
  actions.className = "mt-2";
  actions.append(
    buildButton("Edit", "btn-outline-primary btn-sm", () => {
      openSolutionEditor(kbPath, { source: "draft" }).catch(() => {});
    })
  );

  wrapper.append(details, actions);
  els.adminPanelBody.append(wrapper);
}

function renderAppliedFlagsPanel(appliedFlags) {
  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-2";

  const title = document.createElement("div");
  title.className = "fw-semibold mb-2";
  title.textContent = "Flags";
  wrapper.append(title);

  const flags = Array.isArray(appliedFlags) ? appliedFlags : [];
  if (!flags.length) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary";
    empty.textContent = "No flags applied.";
    wrapper.append(empty);
    els.adminPanelBody.append(wrapper);
    return;
  }

  const list = document.createElement("div");
  list.className = "vstack gap-2";

  flags.forEach((flag) => {
    const message = String(flag && (flag.message || flag.name) ? (flag.message || flag.name) : "").trim();
    if (!message) {
      return;
    }

    const colorMeta = flagColorMeta(flag.colorClass, "text-secondary", flag.backgroundColor);
    const iconHtml = flagIconHtml(flag.iconClass, "me-2");

    const item = document.createElement("div");
    item.className = "border rounded py-2 px-3";
    item.innerHTML = flagTextHtml(`${iconHtml}${escapeHtml(message)}`, colorMeta, "", { fillWidth: true });
    list.append(item);
  });

  if (!list.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary";
    empty.textContent = "No flags applied.";
    wrapper.append(empty);
    els.adminPanelBody.append(wrapper);
    return;
  }

  wrapper.append(list);
  els.adminPanelBody.append(wrapper);
}

function setSolutionFlagsMessage(message, tone = "danger") {
  if (!els.solutionFlagsMessage) {
    return;
  }

  const text = String(message || "").trim();
  if (!text) {
    els.solutionFlagsMessage.className = "small text-danger";
    els.solutionFlagsMessage.textContent = "";
    return;
  }

  const level = ["danger", "warning", "success", "secondary"].includes(tone) ? tone : "danger";
  els.solutionFlagsMessage.className = `small text-${level}`;
  els.solutionFlagsMessage.textContent = text;
}

function renderSolutionFlagsEditor(kbPath, availableFlags, selectedFlagNames) {
  if (!els.solutionFlagsEditor) {
    return;
  }

  els.solutionFlagsEditor.innerHTML = "";
  setSolutionFlagsMessage("");

  const flags = Array.isArray(availableFlags) ? availableFlags : [];
  const selected = new Set(Array.isArray(selectedFlagNames) ? selectedFlagNames : []);

  if (!flags.length) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary";
    empty.textContent = "No flags are defined. Superadmins can create flags in Settings.";
    els.solutionFlagsEditor.append(empty);
    return;
  }

  const safePathPrefix = String(kbPath || "").replace(/[^a-z0-9]/gi, "-").toLowerCase() || "solution";

  flags.forEach((flag, idx) => {
    const row = document.createElement("div");
    row.className = "mb-2";

    const checkboxId = `solution-flag-${safePathPrefix}-${idx}`;
    const colorMeta = flagColorMeta(flag.colorClass, "text-secondary", flag.backgroundColor);
    const iconHtml = flagIconHtml(flag.iconClass, "me-1");
    const restrictionLabel = flag.restrictionType === "roles"
      ? `Roles: ${(flag.allowedRoles || []).join(", ") || "(none)"}`
      : flag.restrictionType === "users"
        ? `Users: ${(flag.allowedUsers || []).join(", ") || "(none)"}`
        : "No restriction";
    const nameHtml = flagTextHtml(`${iconHtml}${escapeHtml(flag.name)}`, colorMeta, "fw-semibold", { fillWidth: true });
    const messageHtml = flagTextHtml(`${iconHtml}${escapeHtml(flag.message || "")}`, colorMeta, "small", { fillWidth: true });

    row.innerHTML = `<div class="form-check">
      <input class="form-check-input kbn-solution-flag-checkbox" type="checkbox" id="${checkboxId}" data-flag-name="${escapeHtml(flag.name)}" ${selected.has(flag.name) ? "checked" : ""} />
      <label class="form-check-label d-block" for="${checkboxId}">${nameHtml}</label>
    </div>
    <div class="ms-4">${messageHtml}</div>
    <div class="small ms-4 text-secondary">${escapeHtml(restrictionLabel)}</div>`;

    const checkbox = row.querySelector(".kbn-solution-flag-checkbox");
    if (checkbox) {
      checkbox.addEventListener("change", () => {
        state.admin.solutionDirty = true;
        setSolutionFlagsMessage("");
      });
    }

    els.solutionFlagsEditor.append(row);
  });

  const helper = document.createElement("div");
  helper.className = "small text-secondary pt-1";
  const submitMode = !Boolean(state.auth && state.auth.canApprove);
  const requiresFlagApproval = Boolean(state.settings.approvals.flagEditsRequireApproval);
  helper.textContent = submitMode && requiresFlagApproval
    ? "Flag changes are submitted with solution approval."
    : "Flag changes are saved when you click Save.";
  els.solutionFlagsEditor.append(helper);
}

function collectSelectedSolutionFlagNames() {
  if (!els.solutionFlagsEditor) {
    return [];
  }

  const inputs = Array.from(els.solutionFlagsEditor.querySelectorAll("input.kbn-solution-flag-checkbox"));
  const selectedNames = inputs
    .filter((input) => Boolean(input.checked))
    .map((input) => String(input.getAttribute("data-flag-name") || "").trim())
    .filter(Boolean);

  return [...new Set(selectedNames)];
}

async function saveSolutionFlagsForCurrentPath() {
  if (!state.admin.solutionPath) {
    return { ok: false, message: "No active solution path." };
  }

  const flagNames = collectSelectedSolutionFlagNames();
  const result = await apiRequest(`/api/admin/solution/flags?path=${encodeURIComponent(state.admin.solutionPath)}`, {
    method: "PUT",
    body: JSON.stringify({ flagNames })
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.message || "Unable to save flags."
    };
  }

  return {
    ok: true,
    flagNames: Array.isArray(result.flagNames) ? result.flagNames : flagNames
  };
}

async function renderVersionHistoryPanel(kbPath) {
  const history = await apiRequest(`/api/admin/history?path=${encodeURIComponent(kbPath)}`);
  if (!history.ok) {
    const wrapper = document.createElement("div");
    wrapper.className = "border rounded p-2 mt-2";
    const error = document.createElement("div");
    error.className = "small text-danger";
    error.textContent = history.message || "Unable to load version history.";
    wrapper.append(error);
    els.adminPanelBody.append(wrapper);
    return;
  }

  const versions = Array.isArray(history.versions) ? history.versions : [];
  if (!versions.length) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "border rounded p-2 mt-2";

  const title = document.createElement("div");
  title.className = "fw-semibold mb-2";
  const nodeTypeLabel = history.nodeType === "solution" ? "Solution" : "Question";
  title.textContent = `${nodeTypeLabel} Version History`;
  wrapper.append(title);

  const list = document.createElement("div");
  list.className = "kbn-history-list";

  versions.forEach((version) => {
    const item = document.createElement("div");
    item.className = "kbn-history-item";

    const details = document.createElement("div");
    details.className = "small flex-grow-1";
    details.innerHTML = `<div class="text-secondary">${escapeHtml(formatDateTime(version.createdAt))} | ${escapeHtml(
      version.createdBy || "system"
    )} | ${escapeHtml(formatHistoryReason(version.reason))}</div>
      <div class="kbn-history-preview">${version.contentPreview ? escapeHtml(version.contentPreview) : "<em class=\"text-secondary\">No preview</em>"}</div>`;

    const rollbackBtn = buildButton("Rollback", "btn-outline-danger btn-sm", async () => {
      rollbackBtn.disabled = true;
      deleteBtn.disabled = true;

      const result = await apiRequest("/api/admin/history/rollback", {
        method: "POST",
        body: JSON.stringify({ path: kbPath, versionId: version.id })
      });

      if (!result.ok) {
        rollbackBtn.disabled = false;
        deleteBtn.disabled = false;
        showToast(result.message || "Rollback failed.", "danger");
        return;
      }

      showToast("Rollback complete.", "success");
      await reloadAdminTreePreserveSelection(kbPath);
    });

    const deleteBtn = buildButton("X", "btn-outline-secondary btn-sm", async () => {
      const confirmed = window.confirm("Delete this version history entry?");
      if (!confirmed) {
        return;
      }

      rollbackBtn.disabled = true;
      deleteBtn.disabled = true;

      const result = await apiRequest("/api/admin/history/delete", {
        method: "POST",
        body: JSON.stringify({ path: kbPath, versionId: version.id })
      });

      if (!result.ok) {
        rollbackBtn.disabled = false;
        deleteBtn.disabled = false;
        showToast(result.message || "Unable to delete version.", "danger");
        return;
      }

      showToast("Version deleted.", "success");
      await reloadAdminTreePreserveSelection(kbPath);
    });
    deleteBtn.title = "Delete version";
    deleteBtn.setAttribute("aria-label", "Delete version");

    const actions = document.createElement("div");
    actions.className = "d-flex gap-1";
    actions.append(rollbackBtn, deleteBtn);

    item.append(details, actions);
    list.append(item);
  });

  wrapper.append(list);
  els.adminPanelBody.append(wrapper);
}

function formatHistoryReason(reasonInput) {
  const reason = String(reasonInput || "snapshot").trim().toLowerCase();
  if (!reason) {
    return "Snapshot";
  }

  return reason
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function openQuestionEditor(path) {
  const result = await apiRequest(`/api/admin/question?path=${encodeURIComponent(path)}`);
  if (!result.ok) {
    showToast(result.message || "Unable to load question.", "danger");
    return;
  }

  state.admin.modalContext.questionPath = path;
  els.questionMessage.textContent = "";
  els.questionText.value = result.question || "";
  state.modals.question.show();
}

function normalizeAnswerKind(kindInput) {
  return kindInput === "solution" ? "solution" : "question";
}

function clearMessageNode(node, tone = "danger") {
  if (!node) {
    return;
  }
  node.className = "small text-" + tone;
  node.textContent = "";
}

function setMessageNode(node, message, tone = "danger") {
  if (!node) {
    return;
  }

  node.className = "small text-" + tone;
  node.textContent = String(message || "").trim();
}

function createBatchAnswerRow(initial = {}) {
  const row = document.createElement("div");
  row.className = "kbn-answer-row border rounded p-2";

  const grid = document.createElement("div");
  grid.className = "row g-2 align-items-end";

  const nameCol = document.createElement("div");
  nameCol.className = "col-md-7";

  const nameLabel = document.createElement("label");
  nameLabel.className = "form-label form-label-sm mb-1";
  nameLabel.textContent = "Answer Name";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "form-control form-control-sm kbn-answer-row-name";
  nameInput.placeholder = "Answer name";
  nameInput.value = String(initial.answerName || "");

  nameCol.append(nameLabel, nameInput);

  const kindCol = document.createElement("div");
  kindCol.className = "col-md-4";

  const kindLabel = document.createElement("label");
  kindLabel.className = "form-label form-label-sm mb-1";
  kindLabel.textContent = "Type";

  const kindSelect = document.createElement("select");
  kindSelect.className = "form-select form-select-sm kbn-answer-row-kind";

  const questionOption = document.createElement("option");
  questionOption.value = "question";
  questionOption.textContent = "question";

  const solutionOption = document.createElement("option");
  solutionOption.value = "solution";
  solutionOption.textContent = "solution";

  kindSelect.append(questionOption, solutionOption);
  kindSelect.value = normalizeAnswerKind(initial.kind);

  kindCol.append(kindLabel, kindSelect);

  const removeCol = document.createElement("div");
  removeCol.className = "col-md-1 d-grid";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-outline-danger btn-sm kbn-answer-row-remove";
  removeBtn.setAttribute("aria-label", "Remove answer row");
  removeBtn.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';

  removeCol.append(removeBtn);

  grid.append(nameCol, kindCol, removeCol);

  const error = document.createElement("div");
  error.className = "small text-danger mt-1 d-none kbn-answer-row-error";

  row.append(grid, error);

  if (initial.error) {
    setBatchAnswerRowError(row, initial.error);
  }

  return row;
}

function setBatchAnswerRowError(row, message) {
  if (!(row instanceof HTMLElement)) {
    return;
  }

  const error = row.querySelector(".kbn-answer-row-error");
  if (!(error instanceof HTMLElement)) {
    return;
  }

  const textValue = String(message || "").trim();
  if (!textValue) {
    error.textContent = "";
    error.classList.add("d-none");
    row.classList.remove("border-danger");
    return;
  }

  error.textContent = textValue;
  error.classList.remove("d-none");
  row.classList.add("border-danger");
}

function clearBatchAnswerRowErrors(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const rows = Array.from(container.querySelectorAll(".kbn-answer-row"));
  rows.forEach((row) => setBatchAnswerRowError(row, ""));
}

function updateBatchAnswerRemoveButtons(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const buttons = Array.from(container.querySelectorAll(".kbn-answer-row-remove"));
  const disableRemove = buttons.length <= 1;
  buttons.forEach((button) => {
    button.disabled = disableRemove;
  });
}

function appendBatchAnswerRow(container, initial = {}) {
  if (!(container instanceof HTMLElement)) {
    return null;
  }

  const row = createBatchAnswerRow(initial);
  container.append(row);
  updateBatchAnswerRemoveButtons(container);
  return row;
}

function resetBatchAnswerRows(container, initialRows = []) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.innerHTML = "";
  const rows = Array.isArray(initialRows) && initialRows.length
    ? initialRows
    : [{ answerName: "", kind: "question" }];

  rows.forEach((row) => {
    appendBatchAnswerRow(container, row || {});
  });

  updateBatchAnswerRemoveButtons(container);
}

function collectBatchAnswerRows(container) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }

  const rows = Array.from(container.querySelectorAll(".kbn-answer-row"));
  return rows.map((row) => {
    const nameInput = row.querySelector(".kbn-answer-row-name");
    const kindSelect = row.querySelector(".kbn-answer-row-kind");
    return {
      row,
      name: String(nameInput && "value" in nameInput ? nameInput.value : "").trim(),
      kind: normalizeAnswerKind(kindSelect && "value" in kindSelect ? kindSelect.value : "question")
    };
  });
}

function onBatchAnswerRowsClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const removeButton = target.closest(".kbn-answer-row-remove");
  if (!removeButton) {
    return;
  }

  const container = removeButton.closest("#topicAnswerRows, #answerRows");
  const row = removeButton.closest(".kbn-answer-row");
  if (!(container instanceof HTMLElement) || !(row instanceof HTMLElement)) {
    return;
  }

  const rowCount = container.querySelectorAll(".kbn-answer-row").length;
  if (rowCount <= 1) {
    return;
  }

  row.remove();
  updateBatchAnswerRemoveButtons(container);
}

function onBatchAnswerRowsInputChange(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const row = target.closest(".kbn-answer-row");
  if (!(row instanceof HTMLElement)) {
    return;
  }

  setBatchAnswerRowError(row, "");
}

function openCreateTopicModal(initialRows = null) {
  clearMessageNode(els.topicMessage, "danger");
  if (els.topicForm) {
    els.topicForm.reset();
  }

  const rows = Array.isArray(initialRows) && initialRows.length
    ? initialRows
    : [{ answerName: "", kind: "question" }];
  resetBatchAnswerRows(els.topicAnswerRows, rows);
  state.modals.topic.show();
}

async function onQuestionSaveSubmit(event) {
  event.preventDefault();
  const kbPath = state.admin.modalContext.questionPath;
  if (!kbPath) {
    return;
  }

  const result = await apiRequest(`/api/admin/question?path=${encodeURIComponent(kbPath)}`, {
    method: "PUT",
    body: JSON.stringify({ question: els.questionText.value })
  });

  if (!result.ok) {
    els.questionMessage.textContent = result.message || "Failed to save question.";
    return;
  }

  clearResolvedIntegrityIndicatorsForPath(kbPath, {
    clearDefaultQuestion: !isDefaultQuestionTextForIntegrity(els.questionText.value),
    clearEmptyQuestion: Boolean(String(els.questionText.value || "").trim())
  });

  state.modals.question.hide();
  showToast("Question saved.", "success");
  await reloadAdminTreePreserveSelection();
}

function openAddAnswerModal(parentPath, initialRows = null, initialMessage = "") {
  state.admin.modalContext.answerParentPath = parentPath;
  clearMessageNode(els.answerMessage, "danger");
  if (els.answerForm) {
    els.answerForm.reset();
  }

  const rows = Array.isArray(initialRows) && initialRows.length
    ? initialRows
    : [{ answerName: "", kind: "question" }];
  resetBatchAnswerRows(els.answerRows, rows);

  if (initialMessage) {
    setMessageNode(els.answerMessage, initialMessage, "warning");
  }

  state.modals.answer.show();
}

async function onCreateAnswerSubmit(event) {
  event.preventDefault();
  const parentPath = state.admin.modalContext.answerParentPath;
  if (!parentPath) {
    return;
  }

  clearMessageNode(els.answerMessage, "danger");
  clearBatchAnswerRowErrors(els.answerRows);

  const entries = collectBatchAnswerRows(els.answerRows).filter((entry) => entry.name);
  if (!entries.length) {
    setMessageNode(els.answerMessage, "Add at least one answer name.", "danger");
    return;
  }

  let createdCount = 0;
  let lastCreatedPath = parentPath;
  const failures = [];

  for (const entry of entries) {
    const result = await apiRequest("/api/admin/answer", {
      method: "POST",
      body: JSON.stringify({
        parentPath,
        answerName: entry.name,
        kind: entry.kind
      })
    });

    if (result.ok) {
      createdCount += 1;
      lastCreatedPath = result.path || lastCreatedPath;
      entry.created = true;
      continue;
    }

    entry.created = false;
    entry.errorMessage = result.message || "Unable to create answer.";
    failures.push(entry);
    setBatchAnswerRowError(entry.row, entry.errorMessage);
  }

  if (createdCount > 0) {
    clearResolvedIntegrityIndicatorsForPath(parentPath, { clearNoAnswers: true });
    await reloadAdminTreePreserveSelection(lastCreatedPath);
  }

  if (!failures.length) {
    state.modals.answer.hide();
    showToast(createdCount === 1 ? "Answer created." : String(createdCount) + " answers created.", "success");
    return;
  }

  entries.filter((entry) => entry.created).forEach((entry) => {
    if (entry.row && typeof entry.row.remove === "function") {
      entry.row.remove();
    }
  });
  updateBatchAnswerRemoveButtons(els.answerRows);

  const tone = createdCount > 0 ? "warning" : "danger";
  const summary = createdCount > 0
    ? "Created " + String(createdCount) + " answer(s). " + String(failures.length) + " failed; fix highlighted rows and try again."
    : "Unable to create answers. " + String(failures.length) + " row(s) need attention.";
  setMessageNode(els.answerMessage, summary, tone);

  if (createdCount > 0) {
    showToast(summary, "warning");
  }
}

function openRenameModal(kbPath) {
  state.admin.modalContext.renamePath = kbPath;
  els.renameMessage.textContent = "";
  document.getElementById("renameNewName").value = kbPath.split("/").pop() || "";
  state.modals.rename.show();
}

function openMoveQuestionModal(sourcePath) {
  const normalizedSourcePath = String(sourcePath || "").trim();
  if (!normalizedSourcePath) {
    showToast("Question path is required.", "danger");
    return;
  }

  state.admin.modalContext.moveQuestionSourcePath = normalizedSourcePath;
  if (els.moveQuestionSource) {
    els.moveQuestionSource.textContent = normalizedSourcePath;
  }
  if (els.moveQuestionMessage) {
    els.moveQuestionMessage.textContent = "";
  }

  const options = flattenNodes(adminRoots().knowledgebaseRoot, "kb")
    .filter((node) => node.scope === "kb" && node.type === "node")
    .map((node) => String(node.path || "").trim())
    .filter((nodePath) => nodePath && nodePath !== normalizedSourcePath && !nodePath.startsWith(`${normalizedSourcePath}/`))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  if (!els.moveQuestionDestination) {
    showToast("Move destination selector is unavailable.", "danger");
    return;
  }

  els.moveQuestionDestination.innerHTML = "";
  options.forEach((nodePath) => {
    const option = document.createElement("option");
    option.value = nodePath;
    option.textContent = nodePath;
    els.moveQuestionDestination.append(option);
  });

  const submitButton = els.moveQuestionForm
    ? els.moveQuestionForm.querySelector('button[type="submit"]')
    : null;

  if (!options.length) {
    if (submitButton) {
      submitButton.disabled = true;
    }
    if (els.moveQuestionMessage) {
      els.moveQuestionMessage.textContent = "No valid destination question nodes available.";
    }
  } else if (submitButton) {
    submitButton.disabled = false;
  }

  if (state.modals.moveQuestion) {
    state.modals.moveQuestion.show();
  }
}

async function onMoveQuestionSubmit(event) {
  event.preventDefault();

  const sourcePath = String(state.admin.modalContext.moveQuestionSourcePath || "").trim();
  const destinationParentPath = els.moveQuestionDestination
    ? String(els.moveQuestionDestination.value || "").trim()
    : "";

  if (!sourcePath || !destinationParentPath) {
    if (els.moveQuestionMessage) {
      els.moveQuestionMessage.textContent = "Source and destination are required.";
    }
    return;
  }

  const result = await apiRequest("/api/admin/move-question", {
    method: "POST",
    body: JSON.stringify({
      sourcePath,
      destinationParentPath
    })
  });

  if (!result.ok) {
    if (els.moveQuestionMessage) {
      els.moveQuestionMessage.textContent = result.message || "Move failed.";
    }
    return;
  }

  if (state.modals.moveQuestion) {
    state.modals.moveQuestion.hide();
  }

  showToast("Question moved successfully.", "success");
  await reloadAdminTreePreserveSelection(result.path || destinationParentPath);
}

async function onRenameSubmit(event) {
  event.preventDefault();
  const kbPath = state.admin.modalContext.renamePath;
  if (!kbPath) {
    return;
  }

  const form = new FormData(els.renameForm);
  const result = await apiRequest("/api/admin/rename", {
    method: "POST",
    body: JSON.stringify({ path: kbPath, newName: form.get("newName") })
  });

  if (!result.ok) {
    els.renameMessage.textContent = result.message || "Rename failed.";
    return;
  }

  state.modals.rename.hide();
  showToast("Renamed successfully.", "success");
  await reloadAdminTreePreserveSelection(result.path);
}
async function deleteKbPath(kbPath) {
  let result = await apiRequest("/api/admin/delete", {
    method: "POST",
    body: JSON.stringify({ path: kbPath, confirmRecursive: false })
  });

  if (!result.ok && result.requiresConfirm) {
    const confirmed = window.confirm("This folder is not empty. Delete recursively?");
    if (!confirmed) {
      return;
    }

    result = await apiRequest("/api/admin/delete", {
      method: "POST",
      body: JSON.stringify({ path: kbPath, confirmRecursive: true })
    });
  }

  if (!result.ok) {
    showToast(result.message || "Delete failed.", "danger");
    return;
  }

  showToast("Moved to trash.", "success");
  await reloadAdminTreePreserveSelection(parentPath(kbPath));
}

async function convertNodeToSolution(kbPath) {
  let result = await apiRequest("/api/admin/convert/node-to-solution", {
    method: "POST",
    body: JSON.stringify({ path: kbPath, confirmDestructive: false })
  });

  if (!result.ok && result.requiresConfirm) {
    const confirmed = window.confirm("Converting to solution will delete child answers. Continue?");
    if (!confirmed) {
      return;
    }

    result = await apiRequest("/api/admin/convert/node-to-solution", {
      method: "POST",
      body: JSON.stringify({ path: kbPath, confirmDestructive: true })
    });
  }

  if (!result.ok) {
    showToast(result.message || "Convert failed.", "danger");
    return;
  }

  showToast("Converted to solution.", "success");
  await reloadAdminTreePreserveSelection(kbPath);
}

async function convertSolutionToNode(kbPath) {
  const question = window.prompt("Enter question text for the converted node:", "New question") || "New question";
  const result = await apiRequest("/api/admin/convert/solution-to-node", {
    method: "POST",
    body: JSON.stringify({ path: kbPath, question })
  });

  if (!result.ok) {
    showToast(result.message || "Convert failed.", "danger");
    return;
  }

  showToast("Converted to node.", "success");
  await reloadAdminTreePreserveSelection(kbPath);
}

async function viewSolutionPreview(kbPath) {
  const result = await apiRequest(`/api/admin/solution/view?path=${encodeURIComponent(kbPath)}`);
  if (!result.ok) {
    showToast(result.message || "Unable to load preview.", "danger");
    return;
  }

  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    showToast("Popup blocked. Enable popups to view solution.", "warning");
    return;
  }

  previewWindow.document.write(`<!doctype html><html><head><title>Solution Preview</title></head><body>${result.solutionHtml || ""}</body></html>`);
  previewWindow.document.close();
}

function promptSolutionDraftChoice(kbPath, draftMeta) {
  if (!state.modals.solutionDraftChoice || !els.solutionDraftChoiceMessage) {
    return Promise.resolve("published");
  }

  const owner = draftMeta && draftMeta.owner ? String(draftMeta.owner) : "unknown";
  const updatedAt = draftMeta && draftMeta.updatedAt ? formatDateTime(draftMeta.updatedAt) : "unknown";
  els.solutionDraftChoiceMessage.textContent = `A draft exists for ${kbPath}. Last saved by ${owner} at ${updatedAt}.`;

  return new Promise((resolve) => {
    state.admin.draftChoiceResolver = resolve;
    state.modals.solutionDraftChoice.show();
  });
}

function resolveSolutionDraftChoice(choiceInput) {
  const resolver = state.admin.draftChoiceResolver;
  if (!resolver) {
    return;
  }

  state.admin.draftChoiceResolver = null;
  if (state.modals.solutionDraftChoice) {
    state.modals.solutionDraftChoice.hide();
  }

  const choice = choiceInput === "draft" ? "draft" : choiceInput === "published" ? "published" : "cancel";
  resolver(choice);
}

function onSolutionDraftChoiceModalHidden() {
  const resolver = state.admin.draftChoiceResolver;
  if (!resolver) {
    return;
  }

  state.admin.draftChoiceResolver = null;
  resolver("cancel");
}

function promptSolutionReviewChoice(kbPath, rejectedMeta) {
  if (!state.modals.solutionReviewChoice || !els.solutionReviewChoiceMessage) {
    return Promise.resolve("published");
  }

  const updatedAt = rejectedMeta && rejectedMeta.updatedAt
    ? formatDateTime(rejectedMeta.updatedAt)
    : "unknown";
  const reviewedBy = rejectedMeta && rejectedMeta.reviewedBy
    ? String(rejectedMeta.reviewedBy)
    : "approver";
  const reason = rejectedMeta && rejectedMeta.reviewReason
    ? String(rejectedMeta.reviewReason)
    : "No reason provided.";

  els.solutionReviewChoiceMessage.innerHTML = "A rejected submission exists for "
    + escapeHtml(kbPath)
    + ".<br/>Reviewed by "
    + escapeHtml(reviewedBy)
    + " at "
    + escapeHtml(updatedAt)
    + ".<br/>Reason: "
    + escapeHtml(reason);

  return new Promise((resolve) => {
    state.admin.reviewChoiceResolver = resolve;
    state.modals.solutionReviewChoice.show();
  });
}

function resolveSolutionReviewChoice(choiceInput) {
  const resolver = state.admin.reviewChoiceResolver;
  if (!resolver) {
    return;
  }

  state.admin.reviewChoiceResolver = null;
  if (state.modals.solutionReviewChoice) {
    state.modals.solutionReviewChoice.hide();
  }

  const choice = choiceInput === "rejected"
    ? "rejected"
    : choiceInput === "published"
      ? "published"
      : "cancel";
  resolver(choice);
}

function onSolutionReviewChoiceModalHidden() {
  const resolver = state.admin.reviewChoiceResolver;
  if (!resolver) {
    return;
  }

  state.admin.reviewChoiceResolver = null;
  resolver("cancel");
}

async function openSolutionEditor(kbPath, options = {}) {
  const result = await apiRequest("/api/admin/solution?path=" + encodeURIComponent(kbPath));
  if (result._status === 423 && result.locked) {
    openLockModal(kbPath, result);
    return;
  }

  if (!result.ok) {
    showToast(result.message || "Unable to open solution editor.", "danger");
    return;
  }

  const reviewPayload = result.review && typeof result.review === "object" ? result.review : {};
  const reviewStatus = reviewPayload.status && typeof reviewPayload.status === "object" ? reviewPayload.status : null;
  const canApprove = Boolean(reviewPayload.canApprove);
  state.settings.approvals.flagEditsRequireApproval = Boolean(
    reviewPayload.settings && reviewPayload.settings.flagEditsRequireApproval
  );

  if (els.solutionPublishBtn) {
    els.solutionPublishBtn.textContent = canApprove ? "Save" : "Submit for Approval";
  }

  const publishedContent = typeof result.publishedContent === "string"
    ? result.publishedContent
    : (typeof result.content === "string" ? result.content : "<p></p>");
  const draftContent = typeof result.draftContent === "string" ? result.draftContent : null;
  const hasDraft = Boolean(result.draftExists && result.draft && draftContent !== null);

  const ownPendingId = reviewStatus && reviewStatus.ownPending ? reviewStatus.ownPending.id : "";
  const ownRejectedId = reviewStatus && reviewStatus.ownRejected ? reviewStatus.ownRejected.id : "";

  let pendingSubmission = null;
  if (ownPendingId) {
    const pendingDetail = await loadSolutionSubmissionDetail(ownPendingId);
    if (pendingDetail.ok && pendingDetail.submission) {
      pendingSubmission = pendingDetail.submission;
    }
  }

  let rejectedSubmission = null;
  if (ownRejectedId) {
    const rejectedDetail = await loadSolutionSubmissionDetail(ownRejectedId);
    if (rejectedDetail.ok && rejectedDetail.submission) {
      rejectedSubmission = rejectedDetail.submission;
    }
  }

  let source = options && ["draft", "published", "pending", "rejected"].includes(options.source)
    ? options.source
    : "";

  if (!source) {
    if (!canApprove && pendingSubmission) {
      source = "pending";
    } else if (!canApprove && rejectedSubmission) {
      const choice = await promptSolutionReviewChoice(kbPath, reviewStatus.ownRejected || rejectedSubmission);
      if (choice === "cancel") {
        await apiRequest("/api/admin/lock/release", {
          method: "POST",
          body: JSON.stringify({ path: kbPath, type: "solution" })
        });
        return;
      }
      source = choice === "rejected" ? "rejected" : "published";
    } else {
      source = "published";
    }
  }

  if (source === "rejected" && !rejectedSubmission) {
    source = "published";
    showToast("Rejected submission not found. Opened published version.", "warning");
  }
  if (source === "pending" && !pendingSubmission) {
    source = "published";
    showToast("Pending submission not found. Opened published version.", "warning");
  }

  if (hasDraft && !options.source && source === "published") {
    const choice = await promptSolutionDraftChoice(kbPath, result.draft);
    if (choice === "cancel") {
      await apiRequest("/api/admin/lock/release", {
        method: "POST",
        body: JSON.stringify({ path: kbPath, type: "solution" })
      });
      return;
    }
    source = choice === "draft" ? "draft" : "published";
  }

  if (!hasDraft && source === "draft") {
    source = "published";
    showToast("No draft found. Opened published version.", "warning");
  }

  let editorContent = publishedContent;
  let stagedImageDeletes = [];
  let stagedFlags = [];

  if (source === "draft" && hasDraft) {
    editorContent = draftContent;
  } else if (source === "pending" && pendingSubmission) {
    editorContent = typeof pendingSubmission.contentHtml === "string" ? pendingSubmission.contentHtml : publishedContent;
    stagedImageDeletes = Array.isArray(pendingSubmission.imageDeletes) ? pendingSubmission.imageDeletes : [];
    stagedFlags = Array.isArray(pendingSubmission.pendingFlags) ? pendingSubmission.pendingFlags : [];
  } else if (source === "rejected" && rejectedSubmission) {
    editorContent = typeof rejectedSubmission.contentHtml === "string" ? rejectedSubmission.contentHtml : publishedContent;
    stagedImageDeletes = Array.isArray(rejectedSubmission.imageDeletes) ? rejectedSubmission.imageDeletes : [];
    stagedFlags = Array.isArray(rejectedSubmission.pendingFlags) ? rejectedSubmission.pendingFlags : [];
  }

  ensureSummernote();
  state.admin.solutionPath = kbPath;
  state.admin.solutionDirty = false;
  state.admin.solutionCloseAllowed = false;
  state.admin.solutionEditSource = source;
  state.admin.solutionDraftMeta = hasDraft ? result.draft : null;
  state.admin.heartbeatSeconds = (result.lockConfig && result.lockConfig.heartbeatSeconds) || 120;
  state.admin.reviewStatus = reviewStatus;
  state.admin.pendingImageDeletes = [...new Set(stagedImageDeletes.map((entry) => String(entry || "").trim()).filter(Boolean))];
  resetSolutionExistingImagesPicker();

  if (els.solutionFlagsSection) {
    els.solutionFlagsSection.classList.remove("d-none");
  }
  renderSolutionFlagsEditor(kbPath, [], []);

  const flagsPreview = await apiRequest("/api/admin/solution/view?path=" + encodeURIComponent(kbPath));
  if (flagsPreview.ok) {
    let selectedFlagNames = Array.isArray(flagsPreview.flagNames) ? flagsPreview.flagNames : [];
    if (!canApprove && state.settings.approvals.flagEditsRequireApproval && stagedFlags.length) {
      selectedFlagNames = stagedFlags;
    }
    renderSolutionFlagsEditor(kbPath, flagsPreview.availableFlags || [], selectedFlagNames);
    applySelectedSolutionFlags(selectedFlagNames);
  } else {
    renderSolutionFlagsEditor(kbPath, [], []);
    setSolutionFlagsMessage(flagsPreview.message || "Unable to load flags for this solution.", "danger");
  }

  els.solutionMessage.textContent = "";
  if (hasDraft && (source === "draft" || source === "published")) {
    const owner = result.draft.owner || "unknown";
    const updatedAt = formatDateTime(result.draft.updatedAt);
    els.draftBanner.classList.remove("d-none");
    if (source === "draft") {
      els.draftBanner.textContent = "Editing latest draft saved by " + owner + " at " + updatedAt + ".";
    } else {
      els.draftBanner.textContent = "Draft available from " + owner + " at " + updatedAt + ". Editing published version.";
    }
  } else {
    els.draftBanner.classList.add("d-none");
    els.draftBanner.textContent = "";
  }

  state.admin.ignoreSummernoteChange = true;
  window.jQuery("#solutionEditor").summernote("code", editorContent || "<p></p>");
  state.admin.ignoreSummernoteChange = false;

  renderSolutionReviewBanner(kbPath);
  startHeartbeat();
  state.modals.solution.show();
}

async function loadSolutionSubmissionDetail(submissionId) {
  if (!submissionId) {
    return { ok: false, message: "Submission id is required." };
  }

  return fetchSubmissionForCurrentUser(submissionId);
}

function applySelectedSolutionFlags(flagNames) {
  if (!els.solutionFlagsEditor) {
    return;
  }

  const selectedSet = new Set(Array.isArray(flagNames) ? flagNames : []);
  const checkboxes = Array.from(els.solutionFlagsEditor.querySelectorAll("input.kbn-solution-flag-checkbox"));
  checkboxes.forEach((checkbox) => {
    const name = String(checkbox.getAttribute("data-flag-name") || "").trim();
    checkbox.checked = selectedSet.has(name);
  });
}

async function refreshCurrentSolutionReviewStatus() {
  if (!state.admin.solutionPath) {
    return;
  }

  const result = await apiRequest("/api/admin/reviews/solution-status?path=" + encodeURIComponent(state.admin.solutionPath));
  if (!result.ok) {
    return;
  }

  state.admin.reviewStatus = result.status && typeof result.status === "object" ? result.status : null;
  if (result.settings && typeof result.settings.flagEditsRequireApproval === "boolean") {
    state.settings.approvals.flagEditsRequireApproval = Boolean(result.settings.flagEditsRequireApproval);
  }
  renderSolutionReviewBanner(state.admin.solutionPath);
}

function renderSolutionReviewBanner(kbPath) {
  if (!els.solutionReviewBanner) {
    return;
  }

  const review = state.admin.reviewStatus;
  const stagedDeletes = Array.isArray(state.admin.pendingImageDeletes) ? state.admin.pendingImageDeletes : [];

  if (!review && !stagedDeletes.length) {
    els.solutionReviewBanner.className = "alert alert-info d-none mb-0";
    els.solutionReviewBanner.textContent = "";
    return;
  }

  let tone = "info";
  let summary = "";
  const actions = [];

  if (review && review.ownPending) {
    tone = "warning";
    summary = "Pending submission from " + formatDateTime(review.ownPending.submittedAt) + ". Awaiting approver review.";
    actions.push('<button type="button" class="btn btn-outline-primary btn-sm" data-review-banner-action="view" data-submission-id="' + escapeHtml(review.ownPending.id) + '">View Submission</button>');
    actions.push('<button type="button" class="btn btn-outline-danger btn-sm" data-review-banner-action="withdraw" data-submission-id="' + escapeHtml(review.ownPending.id) + '">Withdraw</button>');
  } else if (review && review.ownRejected) {
    tone = "danger";
    summary = "Last submission was rejected.";
    if (review.ownRejected.reviewReason) {
      summary += " Reason: " + review.ownRejected.reviewReason;
    }
    actions.push('<button type="button" class="btn btn-outline-primary btn-sm" data-review-banner-action="view" data-submission-id="' + escapeHtml(review.ownRejected.id) + '">View Rejection</button>');
    actions.push('<button type="button" class="btn btn-outline-warning btn-sm" data-review-banner-action="reedit" data-submission-id="' + escapeHtml(review.ownRejected.id) + '">Re-edit Rejected</button>');
  } else if (review && review.blockedByOtherUser && review.activePending) {
    tone = "warning";
    summary = "Another submission is pending for this solution by " + String(review.activePending.submittedBy || "another user") + ".";
  }

  if (!summary && !stagedDeletes.length) {
    els.solutionReviewBanner.className = "alert alert-info d-none mb-0";
    els.solutionReviewBanner.textContent = "";
    return;
  }

  const stagedText = stagedDeletes.length
    ? '<div class="small mt-1">Staged image deletes: ' + escapeHtml(stagedDeletes.join(", ")) + '</div>'
    : "";

  els.solutionReviewBanner.className = "alert alert-" + tone + " mb-0";
  els.solutionReviewBanner.innerHTML = '<div class="small">' + escapeHtml(summary) + '</div>'
    + stagedText
    + (actions.length ? '<div class="d-flex flex-wrap gap-2 mt-2">' + actions.join("") + '</div>' : "");

  const actionButtons = Array.from(els.solutionReviewBanner.querySelectorAll("button[data-review-banner-action]"));
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = String(button.getAttribute("data-review-banner-action") || "").trim().toLowerCase();
      const submissionId = String(button.getAttribute("data-submission-id") || "").trim();
      handleSolutionReviewBannerAction(action, submissionId).catch(() => {});
    });
  });
}

async function handleSolutionReviewBannerAction(action, submissionId) {
  if (!action) {
    return;
  }

  if (action === "view" && submissionId) {
    await openSubmissionViewModal(submissionId, { approverView: false });
    return;
  }

  if (action === "withdraw" && submissionId) {
    await withdrawMySubmission(submissionId);
    await refreshCurrentSolutionReviewStatus();
    return;
  }

  if (action === "reedit" && submissionId) {
    const detail = await loadSolutionSubmissionDetail(submissionId);
    if (!detail.ok || !detail.submission) {
      showToast(detail.message || "Unable to load rejected submission.", "danger");
      return;
    }

    state.admin.ignoreSummernoteChange = true;
    window.jQuery("#solutionEditor").summernote("code", String(detail.submission.contentHtml || "<p></p>"));
    state.admin.ignoreSummernoteChange = false;
    state.admin.solutionEditSource = "rejected";
    state.admin.pendingImageDeletes = Array.isArray(detail.submission.imageDeletes)
      ? [...new Set(detail.submission.imageDeletes.map((entry) => String(entry || "").trim()).filter(Boolean))]
      : [];

    if (state.settings.approvals.flagEditsRequireApproval && Array.isArray(detail.submission.pendingFlags)) {
      applySelectedSolutionFlags(detail.submission.pendingFlags);
    }

    state.admin.solutionDirty = true;
    renderSolutionReviewBanner(state.admin.solutionPath);
    showToast("Loaded rejected submission into editor.", "warning");
  }
}

function ensureSummernote() {
  if (state.admin.summernoteReady) {
    applySummernoteResponsiveHeight();
    return;
  }

  const initialHeight = computeResponsiveSummernoteHeight();
  window.jQuery("#solutionEditor").summernote({
    height: initialHeight,
    dialogsInBody: true,
    buttons: {
      existingImagePicker: function () {
        const ui = window.jQuery.summernote.ui;
        return ui.button({
          contents: '<i class="bi bi-images" aria-hidden="true"></i>',
          tooltip: "Insert Existing Image",
          click: () => {
            openSolutionExistingImagesModal().catch(() => {});
          }
        }).render();
      }
    },
    callbacks: {
      onChange: () => {
        if (!state.admin.ignoreSummernoteChange) {
          state.admin.solutionDirty = true;
        }
      },
      onImageUpload: async (files) => {
        for (const file of files) {
          await uploadEditorImage(file);
        }
      }
    },
    toolbar: [
      ["style", ["style"]],
      ["font", ["bold", "italic", "underline"]],
      ["para", ["ul", "ol", "paragraph"]],
      ["insert", ["link", "picture", "existingImagePicker"]],
      ["view", ["fullscreen"]]
    ]
  });

  state.admin.summernoteReady = true;
  applySummernoteResponsiveHeight();
}

async function openSolutionExistingImagesModal() {
  if (!state.admin.solutionPath) {
    showToast("Open a solution before inserting existing images.", "warning");
    return;
  }

  resetSolutionExistingImagesPicker();
  setSolutionExistingImagesMessage("Loading images...", "secondary");
  state.modals.solutionExistingImages.show();
  await loadSolutionExistingImages();
}

async function loadSolutionExistingImages() {
  if (!state.admin.solutionPath) {
    setSolutionExistingImagesMessage("Solution path is not available.");
    renderSolutionExistingImages([]);
    return;
  }

  const result = await apiRequest(`/api/admin/solution/images?path=${encodeURIComponent(state.admin.solutionPath)}`);
  if (!result.ok) {
    setSolutionExistingImagesMessage(result.message || "Unable to load existing images.");
    renderSolutionExistingImages([]);
    return;
  }

  setSolutionExistingImagesMessage("");
  renderSolutionExistingImages(result.images || []);
}

function renderSolutionExistingImages(images) {
  if (!els.solutionExistingImagesList) {
    return;
  }

  els.solutionExistingImagesList.innerHTML = "";
  const items = Array.isArray(images) ? images : [];
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary border rounded p-3";
    empty.textContent = "No existing images found in this solution folder.";
    els.solutionExistingImagesList.append(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "kbn-existing-images-grid";

  for (const image of items) {
    const filename = String(image && image.filename ? image.filename : "").trim();
    const relativePath = String(image && image.relativePath ? image.relativePath : "").trim();
    if (!filename || !relativePath) {
      continue;
    }

    const imageUrl = kbAssetUrl(relativePath);
    if (!imageUrl) {
      continue;
    }

    const card = document.createElement("article");
    card.className = "kbn-existing-image-card border rounded p-2";

    const previewWrap = document.createElement("div");
    previewWrap.className = "kbn-existing-image-preview";
    const preview = document.createElement("img");
    preview.className = "img-fluid";
    preview.src = imageUrl;
    preview.alt = filename;
    preview.loading = "lazy";
    previewWrap.append(preview);

    const footer = document.createElement("div");
    footer.className = "d-flex align-items-center justify-content-between gap-2 mt-2";

    const name = document.createElement("div");
    name.className = "small text-break kbn-existing-image-name";
    name.textContent = filename;

    const actions = document.createElement("div");
    actions.className = "kbn-existing-image-actions";

    const insertBtn = document.createElement("button");
    insertBtn.type = "button";
    insertBtn.className = "btn btn-outline-primary btn-sm";
    insertBtn.innerHTML = '<i class="bi bi-box-arrow-in-down" aria-hidden="true"></i>';
    insertBtn.setAttribute("title", `Insert ${filename}`);
    insertBtn.setAttribute("aria-label", `Insert ${filename}`);
    insertBtn.setAttribute("data-image-action", "insert");
    insertBtn.setAttribute("data-image-relative-path", relativePath);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-outline-danger btn-sm";
    deleteBtn.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
    deleteBtn.setAttribute("title", `Delete ${filename}`);
    deleteBtn.setAttribute("aria-label", `Delete ${filename}`);
    deleteBtn.setAttribute("data-image-action", "delete");
    deleteBtn.setAttribute("data-image-filename", filename);

    actions.append(insertBtn, deleteBtn);
    footer.append(name, actions);
    card.append(previewWrap, footer);
    grid.append(card);
  }

  if (!grid.childElementCount) {
    const empty = document.createElement("div");
    empty.className = "small text-secondary border rounded p-3";
    empty.textContent = "No existing images found in this solution folder.";
    els.solutionExistingImagesList.append(empty);
    return;
  }

  els.solutionExistingImagesList.append(grid);
}

function onSolutionExistingImagesListClicked(event) {
  const target = event && event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const actionButton = target.closest("button[data-image-action]");
  if (!(actionButton instanceof HTMLButtonElement)) {
    return;
  }

  const action = String(actionButton.getAttribute("data-image-action") || "").trim().toLowerCase();
  if (action === "delete") {
    const filename = String(actionButton.getAttribute("data-image-filename") || "").trim();
    if (!filename) {
      return;
    }
    deleteExistingSolutionImage(filename).catch(() => {});
    return;
  }

  const relativePath = String(actionButton.getAttribute("data-image-relative-path") || "").trim();
  if (!relativePath) {
    return;
  }

  insertExistingSolutionImage(relativePath);
}

function insertExistingSolutionImage(relativePath) {
  const imageUrl = kbAssetUrl(relativePath);
  if (!imageUrl) {
    showToast("Invalid image path.", "danger");
    return;
  }

  if (!state.admin.summernoteReady) {
    showToast("Solution editor is not ready.", "danger");
    return;
  }

  window.jQuery("#solutionEditor").summernote("focus");
  window.jQuery("#solutionEditor").summernote("insertImage", imageUrl);
  state.admin.solutionDirty = true;
  state.modals.solutionExistingImages.hide();
  showToast("Image inserted.", "success");
}

async function deleteExistingSolutionImage(filename) {
  if (!state.admin.solutionPath) {
    showToast("Open a solution before deleting images.", "warning");
    return;
  }

  const confirmed = window.confirm("Delete image '" + filename + "' from this solution folder?");
  if (!confirmed) {
    return;
  }

  if (!(state.auth && state.auth.canApprove)) {
    state.admin.pendingImageDeletes = [...new Set([
      ...(Array.isArray(state.admin.pendingImageDeletes) ? state.admin.pendingImageDeletes : []),
      String(filename || "").trim()
    ].filter(Boolean))];
    state.admin.solutionDirty = true;
    renderSolutionReviewBanner(state.admin.solutionPath);
    showToast("Image delete staged for approval.", "warning");
    await loadSolutionExistingImages();
    return;
  }

  const result = await apiRequest("/api/admin/solution/images/delete", {
    method: "POST",
    body: JSON.stringify({
      path: state.admin.solutionPath,
      filename
    })
  });

  if (!result.ok) {
    setSolutionExistingImagesMessage(result.message || "Unable to delete image.");
    showToast(result.message || "Unable to delete image.", "danger");
    return;
  }

  showToast("Image deleted.", "success");
  await loadSolutionExistingImages();
}

async function uploadEditorImage(file) {
  if (!state.admin.solutionPath) {
    return;
  }

  if (!(state.auth && state.auth.canApprove)) {
    const inlineResult = await fileToDataUrl(file);
    if (!inlineResult.ok) {
      showToast(inlineResult.message || "Image insert failed.", "danger");
      return;
    }

    window.jQuery("#solutionEditor").summernote("insertImage", inlineResult.dataUrl);
    state.admin.solutionDirty = true;
    showToast("Image embedded for approval submission.", "secondary");
    return;
  }

  const formData = new FormData();
  formData.append("image", file);

  const result = await apiFormRequest("/api/admin/upload-image?path=" + encodeURIComponent(state.admin.solutionPath), formData);
  if (!result.ok) {
    showToast(result.message || "Image upload failed.", "danger");
    return;
  }

  const relativePath = String(result.relativePath || state.admin.solutionPath + "/" + (result.filename || ""));
  const imageUrl = kbAssetUrl(relativePath);
  if (!imageUrl) {
    showToast("Image upload succeeded but returned an invalid path.", "danger");
    return;
  }

  window.jQuery("#solutionEditor").summernote("insertImage", imageUrl);
  state.admin.solutionDirty = true;
}

async function fileToDataUrl(file) {
  if (!(file instanceof File)) {
    return { ok: false, message: "Invalid file." };
  }

  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return { ok: false, message: "Only image files are supported for inline submission." };
  }

  return {
    ok: true,
    dataUrl
  };
}

function kbAssetUrl(relativePathInput) {
  const cleaned = String(relativePathInput || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  if (!cleaned) {
    return "";
  }

  const encoded = cleaned
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/asset/${encoded}`;
}

function onSolutionModalHide(event) {
  if (state.admin.solutionCloseAllowed) {
    return;
  }

  if (state.admin.solutionDirty) {
    event.preventDefault();
    state.modals.unsaved.show();
  }
}

async function onSolutionModalHidden() {
  if (state.admin.suppressCloseCleanup) {
    return;
  }

  await cleanupSolutionEditorSession();
}

async function cleanupSolutionEditorSession() {
  if (state.modals.solutionExistingImages) {
    state.modals.solutionExistingImages.hide();
  }
  resetSolutionExistingImagesPicker();
  stopHeartbeat();

  const kbPath = state.admin.solutionPath;
  state.admin.solutionPath = null;
  state.admin.solutionDirty = false;
  state.admin.solutionCloseAllowed = false;
  state.admin.solutionEditSource = "published";
  state.admin.solutionDraftMeta = null;
  state.admin.reviewStatus = null;
  state.admin.pendingImageDeletes = [];
  state.admin.reviewChoiceResolver = null;
  state.admin.lockContext = null;

  if (els.solutionReviewBanner) {
    els.solutionReviewBanner.className = "alert alert-info d-none mb-0";
    els.solutionReviewBanner.textContent = "";
  }

  if (kbPath) {
    await apiRequest("/api/admin/lock/release", {
      method: "POST",
      body: JSON.stringify({ path: kbPath, type: "solution" })
    });
  }

  await reloadAdminTreePreserveSelection(state.admin.selected ? state.admin.selected.path : "");
}

function setSolutionExistingImagesMessage(message, tone = "danger") {
  if (!els.solutionExistingImagesMessage) {
    return;
  }

  const text = String(message || "").trim();
  if (!text) {
    els.solutionExistingImagesMessage.className = "small text-danger";
    els.solutionExistingImagesMessage.textContent = "";
    return;
  }

  const level = ["danger", "warning", "success", "secondary"].includes(tone) ? tone : "danger";
  els.solutionExistingImagesMessage.className = `small text-${level}`;
  els.solutionExistingImagesMessage.textContent = text;
}

function resetSolutionExistingImagesPicker() {
  if (els.solutionExistingImagesList) {
    els.solutionExistingImagesList.innerHTML = "";
  }
  setSolutionExistingImagesMessage("");
}

function startHeartbeat() {
  stopHeartbeat();

  state.admin.heartbeatTimer = window.setInterval(async () => {
    if (!state.admin.solutionPath) {
      return;
    }

    const result = await apiRequest("/api/admin/lock/heartbeat", {
      method: "POST",
      body: JSON.stringify({ path: state.admin.solutionPath, type: "solution" })
    });

    if (!result.ok) {
      showToast("Solution lock heartbeat failed.", "warning");
      stopHeartbeat();
    }
  }, Math.max(10, state.admin.heartbeatSeconds) * 1000);
}

function stopHeartbeat() {
  if (state.admin.heartbeatTimer) {
    window.clearInterval(state.admin.heartbeatTimer);
    state.admin.heartbeatTimer = null;
  }
}

async function onSaveDraftClicked() {
  await saveDraft();
}

async function saveDraft() {
  if (!state.admin.solutionPath) {
    return false;
  }

  const content = window.jQuery("#solutionEditor").summernote("code");
  const result = await apiRequest(`/api/admin/solution/draft?path=${encodeURIComponent(state.admin.solutionPath)}`, {
    method: "POST",
    body: JSON.stringify({ content })
  });

  if (!result.ok) {
    els.solutionMessage.textContent = result.message || "Failed to save draft.";
    return false;
  }

  els.solutionMessage.textContent = "";
  state.admin.solutionDirty = false;
  showToast("Draft saved.", "success");
  return true;
}

async function onDiscardDraftClicked() {
  if (!state.admin.solutionPath) {
    return;
  }

  const result = await apiRequest(`/api/admin/solution/draft?path=${encodeURIComponent(state.admin.solutionPath)}`, {
    method: "DELETE"
  });

  if (!result.ok) {
    els.solutionMessage.textContent = result.message || "Unable to discard draft.";
    return;
  }

  els.solutionMessage.textContent = "";
  state.admin.solutionDirty = false;
  state.admin.solutionDraftMeta = null;
  els.draftBanner.classList.add("d-none");
  els.draftBanner.textContent = "";
  showToast("Draft discarded.", "success");
}

async function onPublishClicked() {
  if (!state.admin.solutionPath) {
    return;
  }

  els.solutionMessage.textContent = "";
  setSolutionFlagsMessage("");

  const canApprove = Boolean(state.auth && state.auth.canApprove);
  const flagApprovalRequired = Boolean(state.settings.approvals.flagEditsRequireApproval);

  let pendingFlags = [];
  if (!canApprove && flagApprovalRequired) {
    pendingFlags = collectSelectedSolutionFlagNames();
  } else {
    const flagSave = await saveSolutionFlagsForCurrentPath();
    if (!flagSave.ok) {
      const message = flagSave.message || "Unable to save flags.";
      setSolutionFlagsMessage(message, "danger");
      showToast(message, "danger");
      return;
    }
  }

  const content = window.jQuery("#solutionEditor").summernote("code");
  const payload = { content };

  if (!canApprove) {
    payload.pendingImageDeletes = Array.isArray(state.admin.pendingImageDeletes)
      ? [...new Set(state.admin.pendingImageDeletes.map((entry) => String(entry || "").trim()).filter(Boolean))]
      : [];

    if (flagApprovalRequired) {
      payload.pendingFlags = pendingFlags;
    }
  }

  const result = await apiRequest("/api/admin/solution?path=" + encodeURIComponent(state.admin.solutionPath), {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    els.solutionMessage.textContent = result.message || (canApprove ? "Save failed." : "Submission failed.");
    return;
  }

  if (result.mode === "published") {
    clearResolvedIntegrityIndicatorsForPath(state.admin.solutionPath, {
      clearDefaultSolution: !isDefaultSolutionHtmlForIntegrity(content),
      clearEmptySolution: Boolean(stripHtmlTextForIntegrity(content))
    });
  }

  state.admin.solutionCloseAllowed = true;
  state.admin.solutionDirty = false;
  state.admin.pendingImageDeletes = [];
  state.modals.solution.hide();

  if (result.mode === "pending-submitted") {
    showToast("Submitted for approval.", "success");
  } else if (result.mode === "pending-updated") {
    showToast("Pending submission updated.", "success");
  } else {
    showToast("Solution saved.", "success");
  }
}

function openLockModal(path, lockResult) {
  state.admin.lockContext = {
    path,
    owner: lockResult.owner,
    expiresAt: lockResult.expiresAt,
    relativeTime: lockResult.relativeTime,
    canForceUnlock: Boolean(lockResult.canForceUnlock)
  };

  const absoluteTime = formatDateTime(lockResult.expiresAt);
  els.lockMessage.textContent = `Locked by ${lockResult.owner} until ${absoluteTime} (${lockResult.relativeTime || "unknown"}).`;
  els.lockForceBtn.disabled = !lockResult.canForceUnlock;
  state.modals.lock.show();
}

async function onLockRefreshClicked() {
  if (!state.admin.lockContext) {
    return;
  }

  state.modals.lock.hide();
  await openSolutionEditor(state.admin.lockContext.path);
}

async function onLockForceClicked() {
  if (!state.admin.lockContext || !state.admin.lockContext.canForceUnlock) {
    return;
  }

  const context = state.admin.lockContext;
  const result = await apiRequest("/api/admin/lock/force-release", {
    method: "POST",
    body: JSON.stringify({ path: context.path, type: "solution", confirm: true })
  });

  if (!result.ok) {
    showToast(result.message || "Unable to force unlock.", "danger");
    return;
  }

  state.modals.lock.hide();
  showToast("Lock released.", "success");
  await openSolutionEditor(context.path);
}

function buildRestoreDestinationOptions() {
  return [
    { label: "/ (Knowledgebase root)", value: "" },
    ...flattenNodes(adminRoots().knowledgebaseRoot, "kb")
      .filter((node) => node.scope === "kb")
      .map((node) => ({ label: node.path, value: node.path }))
  ];
}

function syncRestoreModeInputState() {
  if (!els.restoreMode || !els.restoreNewRootWrap) {
    return;
  }

  const isNewRoot = els.restoreMode.value === "new-root";
  els.restoreNewRootWrap.classList.toggle("d-none", !isNewRoot);
}

function updateRestoreSubmitAvailability() {
  if (!els.restoreSubmitBtn) {
    return;
  }

  const rows = Array.isArray(state.admin.modalContext.restorePlanRows)
    ? state.admin.modalContext.restorePlanRows
    : [];
  if (!rows.length) {
    els.restoreSubmitBtn.disabled = true;
    return;
  }

  const hasUnresolvedConflict = rows.some((row) => {
    if (!row || !row.conflict || !row.conflict.exists) {
      return false;
    }
    return !String(row.selectedAction || "").trim();
  });

  els.restoreSubmitBtn.disabled = hasUnresolvedConflict;
}

function renderRestorePreflightRows() {
  if (!els.restorePreflightRows) {
    return;
  }

  const rows = Array.isArray(state.admin.modalContext.restorePlanRows)
    ? state.admin.modalContext.restorePlanRows
    : [];

  els.restorePreflightRows.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("tr");
    empty.innerHTML = '<td colspan="5" class="small text-secondary">No restore plan available.</td>';
    els.restorePreflightRows.append(empty);
    updateRestoreSubmitAvailability();
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const conflictText = row.conflict && row.conflict.exists
      ? `Yes (${row.conflict.type || "unknown"})`
      : "No";

    const actionCell = document.createElement("td");
    actionCell.setAttribute("data-label", "Action");
    if (row.conflict && row.conflict.exists) {
      const select = document.createElement("select");
      select.className = "form-select form-select-sm";
      select.innerHTML = '<option value="">Select action</option>';
      (Array.isArray(row.allowedActions) ? row.allowedActions : ["restore", "skip", "auto-rename"]).forEach((action) => {
        const option = document.createElement("option");
        option.value = action;
        option.textContent = action;
        if (String(row.selectedAction || "") === action) {
          option.selected = true;
        }
        select.append(option);
      });
      select.addEventListener("change", () => {
        const list = Array.isArray(state.admin.modalContext.restorePlanRows)
          ? state.admin.modalContext.restorePlanRows
          : [];
        if (!list[index]) {
          return;
        }
        list[index].selectedAction = select.value;
        updateRestoreSubmitAvailability();
      });
      actionCell.append(select);
    } else {
      actionCell.className = "small";
      actionCell.textContent = "restore";
    }

    tr.innerHTML = '<td class="small text-break" data-label="Item">' + escapeHtml(row.itemName || "-") + '</td>'
      + '<td class="small text-break" data-label="Original Path">' + escapeHtml(row.originalPath || "-") + '</td>'
      + '<td class="small text-break" data-label="Target Path">' + escapeHtml(row.targetPath || "-") + '</td>'
      + '<td class="small text-nowrap" data-label="Conflict">' + escapeHtml(conflictText) + '</td>';
    tr.append(actionCell);
    els.restorePreflightRows.append(tr);
  });

  updateRestoreSubmitAvailability();
}

async function loadRestorePlan() {
  const trashPaths = Array.isArray(state.admin.modalContext.restoreTrashPaths)
    ? state.admin.modalContext.restoreTrashPaths
    : [];
  if (!trashPaths.length) {
    state.admin.modalContext.restorePlanRows = [];
    renderRestorePreflightRows();
    return;
  }

  const mode = els.restoreMode ? String(els.restoreMode.value || "original") : "original";
  const newRootPath = mode === "new-root" && els.restoreDestination
    ? String(els.restoreDestination.value || "")
    : "";

  const result = await apiRequest("/api/admin/trash/restore-plan", {
    method: "POST",
    body: JSON.stringify({
      trashPaths,
      mode,
      newRootPath
    })
  });

  if (!result.ok) {
    state.admin.modalContext.restorePlanRows = [];
    els.restoreMessage.textContent = result.message || "Unable to build restore plan.";
    renderRestorePreflightRows();
    return;
  }

  els.restoreMessage.textContent = "";
  state.admin.modalContext.restorePlanRows = (Array.isArray(result.rows) ? result.rows : []).map((row) => ({
    ...row,
    selectedAction: row && row.conflict && row.conflict.exists ? "" : "restore"
  }));
  renderRestorePreflightRows();
}

function onRestorePlanInputsChanged() {
  syncRestoreModeInputState();
  loadRestorePlan().catch(() => {
    els.restoreMessage.textContent = "Unable to refresh restore plan.";
  });
}

function openRestoreModal(trashPathsInput) {
  const requestedPaths = Array.isArray(trashPathsInput)
    ? trashPathsInput
    : [trashPathsInput];

  const restoreTrashPaths = [...new Set(
    requestedPaths
      .map((entry) => String(entry || "").trim())
      .filter((entry) => entry.startsWith("_trash/"))
  )];

  state.admin.modalContext.restoreTrashPaths = restoreTrashPaths;
  state.admin.modalContext.restorePlanRows = [];

  els.restoreMessage.textContent = "";
  if (restoreTrashPaths.length === 1) {
    els.restoreItemLabel.textContent = `Item: ${restoreTrashPaths[0]}`;
  } else {
    els.restoreItemLabel.textContent = `${restoreTrashPaths.length} items selected for restore.`;
  }

  const options = buildRestoreDestinationOptions();
  if (els.restoreDestination) {
    els.restoreDestination.innerHTML = "";
    options.forEach((option) => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      els.restoreDestination.append(el);
    });
  }

  if (els.restoreMode) {
    els.restoreMode.value = "original";
  }

  syncRestoreModeInputState();
  renderRestorePreflightRows();
  loadRestorePlan().catch(() => {
    els.restoreMessage.textContent = "Unable to build restore plan.";
  });

  state.modals.restore.show();
}

async function onRestoreSubmit(event) {
  event.preventDefault();

  const rows = Array.isArray(state.admin.modalContext.restorePlanRows)
    ? state.admin.modalContext.restorePlanRows
    : [];
  if (!rows.length) {
    els.restoreMessage.textContent = "No restore plan available.";
    return;
  }

  const unresolved = rows.find((row) => row && row.conflict && row.conflict.exists && !String(row.selectedAction || "").trim());
  if (unresolved) {
    els.restoreMessage.textContent = `Select an action for conflict at ${unresolved.targetPath || unresolved.trashPath}.`;
    return;
  }

  const mode = els.restoreMode ? String(els.restoreMode.value || "original") : "original";
  const newRootPath = mode === "new-root" && els.restoreDestination
    ? String(els.restoreDestination.value || "")
    : "";

  const entries = rows.map((row) => ({
    trashPath: row.trashPath,
    action: row.conflict && row.conflict.exists ? row.selectedAction : "restore"
  }));

  const result = await apiRequest("/api/admin/trash/restore-bulk", {
    method: "POST",
    body: JSON.stringify({ mode, newRootPath, entries })
  });

  const restoredCount = Number(result.restoredCount || 0);
  const failedCount = Number(result.failedCount || 0);
  const skippedCount = Number(result.skippedCount || 0);

  if (!result.ok && restoredCount === 0) {
    els.restoreMessage.textContent = result.message || "Restore failed.";
    return;
  }

  state.modals.restore.hide();

  const restoredSet = new Set(
    Array.isArray(result.results)
      ? result.results
        .filter((entry) => entry && entry.status === "restored" && entry.trashPath)
        .map((entry) => entry.trashPath)
      : []
  );
  Array.from(restoredSet).forEach((trashPath) => {
    state.admin.selectedTrashPaths.delete(trashPath);
  });

  const tone = failedCount > 0 ? "warning" : "success";
  const summary = `Restore complete: ${restoredCount} restored, ${skippedCount} skipped, ${failedCount} failed.`;
  showToast(summary, tone);

  await reloadAdminTreePreserveSelection("_trash");
}

async function purgeSelectedTrashItems(pathsInput = null) {
  const selectedPaths = Array.isArray(pathsInput) && pathsInput.length
    ? [...new Set(pathsInput.map((entry) => String(entry || "").trim()).filter(Boolean))]
    : Array.from(state.admin.selectedTrashPaths || []);
  if (!selectedPaths.length) {
    showToast("No selected trash items.", "warning");
    return;
  }

  const confirmed = window.confirm(`Purge ${selectedPaths.length} selected trash item(s) permanently?`);
  if (!confirmed) {
    return;
  }

  const result = await apiRequest("/api/admin/trash/purge-bulk", {
    method: "POST",
    body: JSON.stringify({
      trashPaths: selectedPaths,
      confirm: true
    })
  });

  const purgedCount = Number(result.purgedCount || 0);
  const failedCount = Number(result.failedCount || 0);

  if (!result.ok && purgedCount === 0) {
    showToast(result.message || "Bulk purge failed.", "danger");
    return;
  }

  if (purgedCount > 0) {
    selectedPaths.forEach((trashPath) => {
      state.admin.selectedTrashPaths.delete(trashPath);
    });
  }

  const tone = failedCount > 0 ? "warning" : "success";
  showToast(`Bulk purge complete: ${purgedCount} purged, ${failedCount} failed.`, tone);
  await reloadAdminTreePreserveSelection("_trash");
}

async function purgeTrashItem(trashPath) {
  const confirmed = window.confirm(`Purge ${trashPath} permanently?`);
  if (!confirmed) {
    return;
  }

  const result = await apiRequest("/api/admin/trash/purge", {
    method: "POST",
    body: JSON.stringify({ trashPath, confirm: true })
  });

  if (!result.ok) {
    showToast(result.message || "Purge failed.", "danger");
    return;
  }

  state.admin.selectedTrashPaths.delete(trashPath);
  showToast("Trash item purged.", "success");
  await reloadAdminTreePreserveSelection("_trash");
}
async function onCreateTopicSubmit(event) {
  event.preventDefault();

  clearMessageNode(els.topicMessage, "danger");
  const form = new FormData(els.topicForm);
  const topicResult = await apiRequest("/api/admin/topic", {
    method: "POST",
    body: JSON.stringify({
      name: form.get("name"),
      question: form.get("question")
    })
  });

  if (!topicResult.ok) {
    setMessageNode(els.topicMessage, topicResult.message || "Unable to create topic.", "danger");
    return;
  }

  const answerEntries = collectBatchAnswerRows(els.topicAnswerRows).filter((entry) => entry.name);
  let createdCount = 0;
  let lastCreatedPath = topicResult.path;
  const failures = [];

  for (const entry of answerEntries) {
    const result = await apiRequest("/api/admin/answer", {
      method: "POST",
      body: JSON.stringify({
        parentPath: topicResult.path,
        answerName: entry.name,
        kind: entry.kind
      })
    });

    if (result.ok) {
      createdCount += 1;
      lastCreatedPath = result.path || lastCreatedPath;
      continue;
    }

    failures.push({
      answerName: entry.name,
      kind: entry.kind,
      error: result.message || "Unable to create answer."
    });
  }

  state.modals.topic.hide();

  if (!failures.length) {
    const successMessage = createdCount > 0
      ? "Topic created with " + String(createdCount) + " answer(s)."
      : "Topic created.";
    showToast(successMessage, "success");
    if (createdCount > 0) {
      clearResolvedIntegrityIndicatorsForPath(topicResult.path, { clearNoAnswers: true });
    }
    await reloadAdminTreePreserveSelection(lastCreatedPath);
    return;
  }

  if (createdCount > 0) {
    clearResolvedIntegrityIndicatorsForPath(topicResult.path, { clearNoAnswers: true });
  }
  await reloadAdminTreePreserveSelection(topicResult.path);
  const warningMessage = createdCount > 0
    ? "Topic created. " + String(createdCount) + " answer(s) added, " + String(failures.length) + " failed."
    : "Topic created. " + String(failures.length) + " answer(s) failed.";
  showToast(warningMessage, "warning");
  openAddAnswerModal(topicResult.path, failures, warningMessage + " Fix remaining rows and save again.");
}

async function reloadAdminTreePreserveSelection(preferredPath) {
  markAdminIntegrityStale();
  await loadAdminTree();

  if (preferredPath && preferredPath.startsWith("_trash")) {
    const trashNode = flattenNodes(adminRoots().trashRoot, "trash").find((n) => n.path === preferredPath);
    state.admin.selected = trashNode || { scope: "trash-root", label: "Trash", path: "_trash", type: "root" };
  } else {
    selectAdminNodeClosest(preferredPath || (state.admin.selected ? state.admin.selected.path : ""));
  }

  renderAdminTree();
  await renderAdminSelection();
  renderAdminIntegrityModal();
  await loadTopics();
}

function adminRoots() {
  return {
    knowledgebaseRoot: state.admin.tree ? state.admin.tree.knowledgebaseRoot : { children: [] },
    trashRoot: state.admin.tree ? state.admin.tree.trashRoot : { children: [] }
  };
}

function flattenNodes(rootNode, scope) {
  const output = [];
  const walk = (node) => {
    if (!node) {
      return;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => {
        output.push({ ...child, scope });
        walk(child);
      });
    }
  };

  walk(rootNode);
  return output;
}

function initializeBootstrapTooltips() {
  if (!window.bootstrap || !bootstrap.Tooltip) {
    return;
  }

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
    bootstrap.Tooltip.getOrCreateInstance(element, { container: "body" });
  });
}

async function openUsersOverlay() {
  if (!state.auth || state.auth.role !== "superadmin") {
    showToast("Superadmin access required.", "danger");
    return;
  }

  els.usersOverlay.classList.remove("d-none");
  activateOverlayFocusTrap(els.usersOverlay, closeUsersOverlay);
  state.users.open = true;
  syncOverlayScrollLock();
  syncCreateApproverControl();
  await refreshUsersTable();
}

function closeUsersOverlay() {
  els.usersOverlay.classList.add("d-none");
  deactivateOverlayFocusTrap(els.usersOverlay);
  state.users.open = false;
  syncOverlayScrollLock();
  els.usersTempPasswordBox.classList.add("d-none");
  els.usersCreateMessage.textContent = "";
  syncCreateApproverControl();
}

function setMySubmissionsMessage(message = "", tone = "danger") {
  if (!els.mySubmissionsMessage) {
    return;
  }

  const level = ["danger", "warning", "success", "secondary"].includes(tone) ? tone : "danger";
  els.mySubmissionsMessage.className = "small text-" + level;
  els.mySubmissionsMessage.textContent = String(message || "").trim();
}

function approvalStatusBadgeHtml(statusInput) {
  const status = String(statusInput || "").trim().toLowerCase();
  const className = status === "pending"
    ? "text-bg-warning"
    : status === "approved"
      ? "text-bg-success"
      : status === "rejected"
        ? "text-bg-danger"
        : "text-bg-secondary";

  return '<span class="badge ' + className + '">' + escapeHtml(status || "unknown") + '</span>';
}

async function openMySubmissionsModal() {
  if (!state.auth || !["admin", "superadmin"].includes(state.auth.role)) {
    showToast("Admin access required.", "danger");
    return;
  }

  state.reviews.open = true;
  setMySubmissionsMessage("");
  if (state.modals.mySubmissions) {
    state.modals.mySubmissions.show();
  }

  await refreshMySubmissionsModal();
}

function onMySubmissionsModalHidden() {
  state.reviews.open = false;
  setMySubmissionsMessage("");
}

async function refreshMySubmissionsModal() {
  const mineResult = await apiRequest("/api/admin/reviews/mine?status=pending,rejected&limit=100");
  if (!mineResult.ok) {
    setMySubmissionsMessage(mineResult.message || "Unable to load submissions.", "danger");
    return;
  }

  state.reviews.mine = Array.isArray(mineResult.submissions) ? mineResult.submissions : [];
  renderMySubmissionsRows();

  const canApprove = Boolean(state.auth && state.auth.canApprove);
  if (els.reviewQueueTabWrap) {
    els.reviewQueueTabWrap.classList.toggle("d-none", !canApprove);
  }

  if (!canApprove) {
    state.reviews.pending = [];
    renderReviewQueueRows();
    return;
  }

  const pendingResult = await apiRequest("/api/admin/reviews/pending?limit=200");
  if (!pendingResult.ok) {
    setMySubmissionsMessage(pendingResult.message || "Unable to load review queue.", "danger");
    return;
  }

  state.reviews.pending = Array.isArray(pendingResult.submissions) ? pendingResult.submissions : [];
  renderReviewQueueRows();
}

function renderMySubmissionsRows() {
  if (!els.mySubmissionsRows) {
    return;
  }

  const rows = Array.isArray(state.reviews.mine) ? state.reviews.mine : [];
  els.mySubmissionsRows.innerHTML = "";

  if (els.mySubmissionsSummary) {
    const pendingCount = rows.filter((entry) => entry && entry.status === "pending").length;
    const rejectedCount = rows.filter((entry) => entry && entry.status === "rejected").length;
    els.mySubmissionsSummary.textContent = rows.length
      ? rows.length + " item(s) | Pending: " + pendingCount + " | Rejected: " + rejectedCount
      : "No pending or rejected submissions.";
  }

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="small text-secondary">No pending or rejected submissions.</td>';
    els.mySubmissionsRows.append(tr);
    return;
  }

  rows.forEach((submission) => {
    const tr = document.createElement("tr");
    const reason = String(submission.reviewReason || "").trim();
    const actions = [];

    actions.push('<button type="button" class="btn btn-outline-secondary btn-sm" data-submission-action="open" data-submission-path="' + escapeHtml(submission.path) + '" data-submission-status="' + escapeHtml(submission.status) + '">Open</button>');
    actions.push('<button type="button" class="btn btn-outline-primary btn-sm" data-submission-action="view" data-submission-id="' + escapeHtml(submission.id) + '">View</button>');

    if (submission.status === "pending") {
      actions.push('<button type="button" class="btn btn-outline-danger btn-sm" data-submission-action="withdraw" data-submission-id="' + escapeHtml(submission.id) + '">Withdraw</button>');
    } else if (submission.status === "rejected") {
      actions.push('<button type="button" class="btn btn-outline-warning btn-sm" data-submission-action="reedit" data-submission-path="' + escapeHtml(submission.path) + '">Re-edit</button>');
    }

    tr.innerHTML = '<td class="small text-break">' + escapeHtml(submission.path || "") + '</td>'
      + '<td>' + approvalStatusBadgeHtml(submission.status) + '</td>'
      + '<td class="small text-nowrap">' + escapeHtml(formatDateTime(submission.submittedAt)) + '</td>'
      + '<td class="small text-nowrap">' + escapeHtml(submission.reviewedAt ? formatDateTime(submission.reviewedAt) : "-") + '</td>'
      + '<td class="small text-break">' + escapeHtml(reason || "-") + '</td>'
      + '<td class="d-flex gap-1 flex-wrap">' + actions.join("") + '</td>';

    els.mySubmissionsRows.append(tr);
  });
}

function renderReviewQueueRows() {
  if (!els.reviewQueueRows) {
    return;
  }

  const rows = Array.isArray(state.reviews.pending) ? state.reviews.pending : [];
  els.reviewQueueRows.innerHTML = "";

  if (els.reviewQueueSummary) {
    els.reviewQueueSummary.textContent = rows.length
      ? rows.length + " pending submission(s)."
      : "No pending submissions.";
  }

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4" class="small text-secondary">No pending submissions.</td>';
    els.reviewQueueRows.append(tr);
    return;
  }

  rows.forEach((submission) => {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="small text-break">' + escapeHtml(submission.path || "") + '</td>'
      + '<td class="small">' + escapeHtml(submission.submittedBy || "") + '</td>'
      + '<td class="small text-nowrap">' + escapeHtml(formatDateTime(submission.submittedAt)) + '</td>'
      + '<td class="d-flex gap-1 flex-wrap">'
      + '<button type="button" class="btn btn-outline-primary btn-sm" data-review-action="view" data-submission-id="' + escapeHtml(submission.id) + '">View</button>'
      + '<button type="button" class="btn btn-outline-success btn-sm" data-review-action="approve" data-submission-id="' + escapeHtml(submission.id) + '">Approve</button>'
      + '<button type="button" class="btn btn-outline-danger btn-sm" data-review-action="reject" data-submission-id="' + escapeHtml(submission.id) + '">Reject</button>'
      + '</td>';

    els.reviewQueueRows.append(tr);
  });
}

async function onMySubmissionsRowsClicked(event) {
  const target = event && event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-submission-action]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const action = String(button.getAttribute("data-submission-action") || "").trim().toLowerCase();
  const submissionId = String(button.getAttribute("data-submission-id") || "").trim();
  const submissionPath = String(button.getAttribute("data-submission-path") || "").trim();
  const status = String(button.getAttribute("data-submission-status") || "").trim().toLowerCase();

  if (action === "view" && submissionId) {
    await openSubmissionViewModal(submissionId, { approverView: false });
    return;
  }

  if (action === "withdraw" && submissionId) {
    await withdrawMySubmission(submissionId);
    return;
  }

  if ((action === "open" || action === "reedit") && submissionPath) {
    if (state.modals.mySubmissions) {
      state.modals.mySubmissions.hide();
    }
    await openSolutionEditor(submissionPath, { source: status === "rejected" ? "rejected" : "pending" });
  }
}

async function onReviewQueueRowsClicked(event) {
  const target = event && event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button[data-review-action]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const action = String(button.getAttribute("data-review-action") || "").trim().toLowerCase();
  const submissionId = String(button.getAttribute("data-submission-id") || "").trim();
  if (!submissionId) {
    return;
  }

  if (action === "view") {
    await openSubmissionViewModal(submissionId, { approverView: true });
    return;
  }

  if (action === "approve") {
    await approveSubmissionFromQueue(submissionId);
    return;
  }

  if (action === "reject") {
    await rejectSubmissionFromQueue(submissionId);
  }
}

async function openSubmissionViewModal(submissionId, options = {}) {
  const approverView = Boolean(options && options.approverView);
  const endpoint = approverView
    ? "/api/admin/reviews/submissions/" + encodeURIComponent(submissionId)
    : "/api/admin/reviews/mine/" + encodeURIComponent(submissionId);

  const result = await apiRequest(endpoint);
  if (!result.ok) {
    setMySubmissionsMessage(result.message || "Unable to load submission detail.", "danger");
    return;
  }

  if (els.submissionViewMeta) {
    els.submissionViewMeta.innerHTML = "Path: " + escapeHtml(result.submission.path || "")
      + " | Status: " + approvalStatusBadgeHtml(result.submission.status)
      + " | Submitted by: " + escapeHtml(result.submission.submittedBy || "")
      + " | Submitted: " + escapeHtml(formatDateTime(result.submission.submittedAt));
  }
  if (els.submissionViewSubmitted) {
    els.submissionViewSubmitted.innerHTML = String(result.submission.contentHtml || "<em>No content</em>");
  }
  if (els.submissionViewPublished) {
    els.submissionViewPublished.innerHTML = String(result.publishedContent || "<em>No content</em>");
  }
  if (els.submissionViewMessage) {
    els.submissionViewMessage.className = "small text-danger";
    els.submissionViewMessage.textContent = "";
  }

  if (state.modals.submissionView) {
    state.modals.submissionView.show();
  }
}

async function withdrawMySubmission(submissionId) {
  const confirmed = window.confirm("Withdraw this pending submission?");
  if (!confirmed) {
    return;
  }

  const result = await apiRequest("/api/admin/reviews/submissions/" + encodeURIComponent(submissionId) + "/withdraw", {
    method: "POST"
  });
  if (!result.ok) {
    setMySubmissionsMessage(result.message || "Unable to withdraw submission.", "danger");
    return;
  }

  showToast("Submission withdrawn.", "success");
  await refreshMySubmissionsModal();
  if (state.admin.solutionPath && result.submission && result.submission.path === state.admin.solutionPath) {
    await refreshCurrentSolutionReviewStatus();
  }
}

async function approveSubmissionFromQueue(submissionId) {
  const result = await apiRequest("/api/admin/reviews/submissions/" + encodeURIComponent(submissionId) + "/approve", {
    method: "POST"
  });

  if (!result.ok) {
    setMySubmissionsMessage(result.message || "Unable to approve submission.", "danger");
    return;
  }

  showToast("Submission approved.", "success");
  await refreshMySubmissionsModal();
  await reloadAdminTreePreserveSelection(result.submission ? result.submission.path : "");
}

async function rejectSubmissionFromQueue(submissionId) {
  const reason = String(window.prompt("Enter rejection reason:", "") || "").trim();
  if (!reason) {
    setMySubmissionsMessage("Rejection reason is required.", "warning");
    return;
  }

  const result = await apiRequest("/api/admin/reviews/submissions/" + encodeURIComponent(submissionId) + "/reject", {
    method: "POST",
    body: JSON.stringify({ reason })
  });

  if (!result.ok) {
    setMySubmissionsMessage(result.message || "Unable to reject submission.", "danger");
    return;
  }

  showToast("Submission rejected.", "success");
  await refreshMySubmissionsModal();
}

async function fetchSubmissionForCurrentUser(submissionId) {
  return apiRequest("/api/admin/reviews/mine/" + encodeURIComponent(submissionId));
}

async function refreshUsersTable() {
  const result = await apiRequest("/api/superadmin/users/");
  if (!result.ok) {
    showToast(result.message || "Unable to load users.", "danger");
    return;
  }

  state.users.list = result.users || [];
  renderUsersTable();
}

function renderUsersTable() {
  els.usersTableBody.innerHTML = "";

  const normalizedCurrentUser = state.auth ? String(state.auth.username || "").trim().toLowerCase() : "";
  const superadminCount = state.users.list.filter((entry) => entry.role === "superadmin").length;

  state.users.list.forEach((user) => {
    const row = document.createElement("tr");

    const usernameCell = document.createElement("td");
    usernameCell.textContent = user.username;

    const roleCell = document.createElement("td");
    const roleSelect = document.createElement("select");
    roleSelect.className = "form-select form-select-sm";
    ["user", "admin", "superadmin"].forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      option.selected = role === user.role;
      roleSelect.append(option);
    });

    const approverCell = document.createElement("td");
    const approverWrap = document.createElement("div");
    approverWrap.className = "form-check form-switch";
    const approverId = "user-approver-" + String(user.username || "").replace(/[^a-z0-9_-]/gi, "-");
    const approverToggle = document.createElement("input");
    approverToggle.className = "form-check-input";
    approverToggle.type = "checkbox";
    approverToggle.id = approverId;
    approverToggle.checked = Boolean(user.canApprove);
    approverToggle.setAttribute("role", "switch");
    approverWrap.append(approverToggle);
    approverCell.append(approverWrap);

    const auditCell = document.createElement("td");
    const auditWrap = document.createElement("div");
    auditWrap.className = "form-check form-switch";
    const auditId = "user-audit-" + String(user.username || "").replace(/[^a-z0-9_-]/gi, "-");
    const auditToggle = document.createElement("input");
    auditToggle.className = "form-check-input";
    auditToggle.type = "checkbox";
    auditToggle.id = auditId;
    auditToggle.checked = Boolean(user.canViewAudit);
    auditToggle.setAttribute("role", "switch");
    auditWrap.append(auditToggle);
    auditCell.append(auditWrap);

    const normalizedRowUser = String(user.username || "").trim().toLowerCase();
    const isSelfSuperadmin = user.role === "superadmin" && normalizedCurrentUser === normalizedRowUser;
    const isLastSuperadmin = user.role === "superadmin" && superadminCount <= 1;

    if (isSelfSuperadmin || isLastSuperadmin) {
      Array.from(roleSelect.options).forEach((option) => {
        if (option.value !== "superadmin") {
          option.disabled = true;
        }
      });
    }

    roleCell.append(roleSelect);

    const createdCell = document.createElement("td");
    createdCell.textContent = formatDateTime(user.createdAt);

    const loginCell = document.createElement("td");
    loginCell.textContent = user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never";

    const actionsCell = document.createElement("td");
    actionsCell.className = "d-flex gap-1 flex-wrap";

    const saveRoleBtn = buildButton("Save Access", "btn-outline-secondary btn-sm", async () => {
      const roleValue = String(roleSelect.value || "user").trim().toLowerCase();
      const canApproveValue = roleValue === "user" ? false : Boolean(approverToggle.checked);
      const canViewAuditValue = roleValue === "user" ? false : Boolean(auditToggle.checked);
      const result = await apiRequest("/api/superadmin/users/update-role", {
        method: "POST",
        body: JSON.stringify({
          username: user.username,
          role: roleValue,
          canApprove: canApproveValue,
          canViewAudit: canViewAuditValue
        })
      });

      if (!result.ok) {
        showToast(result.message || "Access update failed.", "danger");
        return;
      }

      showToast("Access updated.", "success");
      await refreshUsersTable();
    });

    const resetBtn = buildButton("Reset Password", "btn-outline-warning btn-sm", async () => {
      const result = await apiRequest("/api/superadmin/users/reset-password", {
        method: "POST",
        body: JSON.stringify({ username: user.username })
      });

      if (!result.ok) {
        showToast(result.message || "Password reset failed.", "danger");
        return;
      }

      els.usersTempPasswordBox.classList.remove("d-none");
      els.usersTempPasswordBox.textContent = "Temporary password for " + result.username + ": " + result.tempPassword;
    });

    const deleteBtn = buildButton("Delete", "btn-outline-danger btn-sm", async () => {
      if (deleteBtn.disabled) {
        return;
      }

      const confirmed = window.confirm("Delete user " + user.username + "? This will also delete drafts and release locks.");
      if (!confirmed) {
        return;
      }

      const result = await apiRequest("/api/superadmin/users/delete", {
        method: "POST",
        body: JSON.stringify({ username: user.username, confirm: true })
      });

      if (!result.ok) {
        showToast(result.message || "Delete failed.", "danger");
        return;
      }

      showToast("Deleted " + user.username + ".", "success");
      await refreshUsersTable();
    });

    const refreshGuardState = () => {
      const selectedRole = String(roleSelect.value || "user").trim().toLowerCase();

      if (selectedRole === "user") {
        approverToggle.checked = false;
        approverToggle.disabled = true;
        auditToggle.checked = false;
        auditToggle.disabled = true;
      } else {
        approverToggle.disabled = false;
        auditToggle.disabled = false;
      }

      if (isSelfSuperadmin && selectedRole !== "superadmin") {
        saveRoleBtn.disabled = true;
        saveRoleBtn.title = "Superadmin self-demotion is blocked in MVP.";
      } else if (isLastSuperadmin && selectedRole !== "superadmin") {
        saveRoleBtn.disabled = true;
        saveRoleBtn.title = "Cannot remove role from the last remaining superadmin.";
      } else {
        saveRoleBtn.disabled = false;
        saveRoleBtn.title = "";
      }

      if (isSelfSuperadmin) {
        deleteBtn.disabled = true;
        deleteBtn.title = "Superadmin self-delete is blocked in MVP.";
      } else if (isLastSuperadmin) {
        deleteBtn.disabled = true;
        deleteBtn.title = "Cannot delete the last remaining superadmin.";
      } else {
        deleteBtn.disabled = false;
        deleteBtn.title = "";
      }
    };

    roleSelect.addEventListener("change", refreshGuardState);
    refreshGuardState();

    actionsCell.append(saveRoleBtn, resetBtn, deleteBtn);
    row.append(usernameCell, roleCell, approverCell, auditCell, createdCell, loginCell, actionsCell);
    els.usersTableBody.append(row);
  });
}

async function onCreateUserSubmit(event) {
  event.preventDefault();
  els.usersCreateMessage.textContent = "";

  const form = new FormData(els.createUserForm);
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    els.usersCreateMessage.textContent = "Password confirmation does not match.";
    return;
  }

  const role = String(form.get("role") || "user").trim().toLowerCase();
  const canApprove = role === "user"
    ? false
    : Boolean(els.createCanApprove && els.createCanApprove.checked);
  const canViewAudit = role === "user"
    ? false
    : Boolean(els.createCanViewAudit && els.createCanViewAudit.checked);


  const result = await apiRequest("/api/superadmin/users/", {
    method: "POST",
    body: JSON.stringify({
      username: form.get("username"),
      role,
      canApprove,
      canViewAudit,
      password
    })
  });

  if (!result.ok) {
    els.usersCreateMessage.textContent = result.message || "Unable to create user.";
    return;
  }

  els.createUserForm.reset();
  syncCreateApproverControl();
  showToast("User created.", "success");
  await refreshUsersTable();
}

function selectionsFromPathQuery() {
  const params = new URLSearchParams(window.location.search);
  const pathValue = params.get("path");
  if (!pathValue) {
    return [];
  }

  const segments = pathValue
    .replaceAll("\\", "/")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);

  return segments.map((_, idx) => segments.slice(0, idx + 1).join("/"));
}

function updatePathQuery(pathValue, { pushHistory, replaceHistory }) {
  const params = new URLSearchParams(window.location.search);
  if (pathValue) {
    params.set("path", pathValue);
  } else {
    params.delete("path");
  }

  const url = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  if (replaceHistory) {
    window.history.replaceState({}, "", url);
    return;
  }
  if (pushHistory) {
    window.history.pushState({}, "", url);
  }
}

function buildButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn ${className}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function appendKeyValue(container, key, value) {
  const row = document.createElement("div");
  row.className = "kv-row";
  row.innerHTML = `<div class="kv-key">${escapeHtml(key)}</div><div class="kv-value">${escapeHtml(String(value || ""))}</div>`;
  container.append(row);
}

function parentPath(pathValue) {
  if (!pathValue || !pathValue.includes("/")) {
    return "";
  }
  return pathValue.substring(0, pathValue.lastIndexOf("/"));
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return String(value);
  }
  return dt.toLocaleString();
}

function formatDateTimeCompact(value) {
  if (!value) {
    return "Unknown";
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return String(value);
  }

  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTimeOfDay(value) {
  if (!value) {
    return "";
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return String(value);
  }

  return dt.toLocaleTimeString();
}

function formatNumber(valueInput, decimalsInput = 0) {
  const value = Number(valueInput);
  if (!Number.isFinite(value)) {
    return "0";
  }

  const decimals = Number.isFinite(Number(decimalsInput))
    ? Math.max(0, Math.min(6, Math.floor(Number(decimalsInput))))
    : 0;

  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, level = "info") {
  const toast = document.createElement("div");
  const bgClass = level === "danger"
    ? "text-bg-danger"
    : level === "warning"
      ? "text-bg-warning"
      : level === "success"
        ? "text-bg-success"
        : "text-bg-secondary";

  toast.className = `toast align-items-center ${bgClass}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  els.toastContainer.append(toast);
  const instance = new bootstrap.Toast(toast, { delay: 3200 });
  toast.addEventListener("hidden.bs.toast", () => {
    toast.remove();
  });
  instance.show();
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, message: "Invalid server response." };
  }

  if (!response.ok && data.ok !== false) {
    data.ok = false;
  }

  data._status = response.status;
  return data;
}

async function apiFormRequest(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "same-origin"
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, message: "Invalid server response." };
  }

  if (!response.ok && data.ok !== false) {
    data.ok = false;
  }

  data._status = response.status;
  return data;
}





