const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createApp } = require("../server/server");
const yazl = require("yazl");

const ENV_KEYS = [
  "DATA_DIR",
  "KB_ROOT",
  "DRAFTS_DIR",
  "SESSIONS_DIR",
  "LOGS_DIR",
  "BACKUPS_DIR",
  "FLAGS_FILE",
  "VERSIONS_FILE",
  "AUTH_MODE",
  "SESSION_SECRET",
  "NODE_ENV",
  "BACKUP_UPLOAD_MAX_BYTES",
  "BACKUP_SCHEDULER_TICK_SECONDS"
];

test("optional auth mode: setup, auth, admin flow, and superadmin user flow", async () => {
  await withServer({ authMode: "optional" }, async ({ request, tempRoot }) => {
    let response;

    response = await request("GET", "/api/setup/status");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.needsSetup, true);

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.user.role, "superadmin");

    response = await request("GET", "/api/auth/me");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.authMode, "optional");

    response = await request("GET", "/api/admin/search/index/status");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.ready, true);

    response = await request("GET", "/api/admin/tree/status");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(typeof response.json.dirty, "boolean");
    assert.equal(typeof response.json.rebuilding, "boolean");

    response = await request("POST", "/api/admin/search/index/rebuild", {
      reason: "integration-bootstrap"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/admin/topic", {
      name: "Printer",
      question: "What is the printer issue?"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/tree");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/tree/status");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.hasCache, true);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "Printer",
      answerName: "WiFi",
      kind: "solution"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/solution?path=Printer/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const existingImageDir = path.join(tempRoot, "data", "Knowledgebase", "Printer", "WiFi");
    await fs.writeFile(path.join(existingImageDir, "old-diagram.png"), "not-a-real-image", "utf8");
    await fs.writeFile(path.join(existingImageDir, "wifi-photo.JPG"), "not-a-real-image", "utf8");
    await fs.writeFile(path.join(existingImageDir, "notes.txt"), "ignore-me", "utf8");

    response = await request("GET", "/api/admin/solution/images?path=Printer/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.deepEqual(
      response.json.images.map((entry) => entry.filename),
      ["old-diagram.png", "wifi-photo.JPG"]
    );

    response = await request("POST", "/api/admin/solution/images/delete", {
      path: "Printer/WiFi",
      filename: "wifi-photo.JPG"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/solution/images?path=Printer/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.deepEqual(
      response.json.images.map((entry) => entry.filename),
      ["old-diagram.png"]
    );

    response = await request("POST", "/api/admin/solution/images/delete", {
      path: "Printer/WiFi",
      filename: "notes.txt"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("GET", "/api/admin/solution/images?path=Printer");
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/admin/solution/draft?path=Printer/WiFi", {
      content: "<p>Draft body</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/admin/lock/release", {
      path: "Printer/WiFi",
      type: "solution"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/admin/rename", {
      path: "Printer",
      newName: "PrinterRenamed"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.path, "PrinterRenamed");
    assert.equal(response.json.movedDrafts, 1);
    assert.ok(response.json.movedVersionPaths >= 0);

    response = await request("GET", "/api/admin/solution?path=PrinterRenamed/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.draftExists, true);
    assert.equal(typeof response.json.publishedContent, "string");
    assert.equal(typeof response.json.draftContent, "string");
    assert.match(response.json.draftContent, /Draft body/);
    assert.equal(response.json.content, response.json.publishedContent);

    response = await request("GET", "/api/admin/solution/draft?path=PrinterRenamed/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.draftExists, true);

    response = await request("PUT", "/api/admin/solution?path=PrinterRenamed/WiFi", {
      content: '<h2 style="color:red">Published</h2>'
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/node?path=PrinterRenamed/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.type, "terminal");

    response = await request("GET", "/api/public/stats");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.solutionCount, 1);

    response = await request("GET", "/api/admin/solution?path=PrinterRenamed/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/admin/solution/draft?path=PrinterRenamed/WiFi", {
      content: "<p>Delete me</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/admin/lock/release", {
      path: "PrinterRenamed/WiFi",
      type: "solution"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const draftCountBeforeDelete = await countDraftFiles(tempRoot);
    assert.equal(draftCountBeforeDelete, 1);

    response = await request("POST", "/api/admin/delete", {
      path: "PrinterRenamed",
      confirmRecursive: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.deletedDrafts, 1);
    assert.ok(response.json.deletedVersionPaths >= 0);
    assert.ok(response.json.releasedLocks >= 0);

    const draftCountAfterDelete = await countDraftFiles(tempRoot);
    assert.equal(draftCountAfterDelete, 0);

    response = await request("GET", "/api/public/stats");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.solutionCount, 0);

    response = await request("POST", "/api/superadmin/users/", {
      username: "alice",
      password: "Bb!23456",
      role: "admin"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/superadmin/users/", {
      username: "bad-symbol-user",
      password: "Aa!23456\u2603",
      role: "user"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);
    assert.match(response.json.message, /unsupported symbol/i);

    response = await request("POST", "/api/superadmin/users/", {
      username: "carol",
      password: "Cc!23456",
      role: "superadmin"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/superadmin/users/update-role", {
      username: "root",
      role: "admin"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);
    assert.match(response.json.message, /self-demotion/i);

    response = await request("POST", "/api/superadmin/users/delete", {
      username: "root",
      confirm: true
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);
    assert.match(response.json.message, /self-delete/i);

    response = await request("POST", "/api/superadmin/users/reset-password", {
      username: "alice"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(response.json.tempPassword);

    response = await request("POST", "/api/superadmin/users/delete", {
      username: "alice",
      confirm: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/superadmin/users/delete", {
      username: "carol",
      confirm: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });
});

test("required auth mode: read endpoints require login", async () => {
  await withServer({ authMode: "required" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/auth/me");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, false);
    assert.equal(response.json.authMode, "required");

    response = await request("GET", "/api/topics");
    assert.equal(response.status, 401);
    assert.equal(response.json.ok, false);

    response = await request("GET", "/api/search?q=wifi");
    assert.equal(response.status, 401);
    assert.equal(response.json.ok, false);

    response = await request("GET", "/api/ui/settings");
    assert.equal(response.status, 401);
    assert.equal(response.json.ok, false);

    response = await request("GET", "/api/public/stats");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.solutionCount, 0);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/topics");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/search?q=wifi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/ui/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.uiSettings.autoContrastFlagBackground, true);
    assert.equal(response.json.uiSettings.autoContrastStrictness, 4.5);
  });
});





test("required auth mode in production mode over http: login session persists", async () => {
  await withServer({ authMode: "required", nodeEnv: "production" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/auth/me");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.user.username, "root");

    response = await request("GET", "/api/topics");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/ui/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });
});

test("ui display preferences: per-account persistence and role filtering", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("GET", "/api/ui/preferences/display");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.canManageTree, false);
    assert.equal(response.json.display.theme, "light");

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/users/", {
      username: "bob",
      password: "Bb!23456",
      role: "user"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/ui/preferences/display", {
      display: {
        theme: "black",
        treeQuestionColor: "#112233",
        treeQuestionSizePx: 18,
        treeQuestionBold: true,
        treeQuestionItalic: true,
        treeQuestionUnderline: true,
        treeSolutionColor: "#445566",
        treeSolutionSizePx: 17,
        treeSolutionBold: false,
        treeSolutionItalic: true,
        treeSolutionUnderline: false,
        showQuestionTextInTree: true,
        treeQuestionTextColor: "#778899",
        treeQuestionTextSizePx: 12,
        treeQuestionTextBold: true,
        treeQuestionTextItalic: false,
        treeQuestionTextUnderline: true,
        treeHighlightColor: "#abcdef"
      }
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.canManageTree, true);
    assert.equal(response.json.display.theme, "black");
    assert.equal(response.json.display.treeQuestionColor, "#112233");
    assert.equal(response.json.display.treeQuestionSizePx, 18);
    assert.equal(response.json.display.showQuestionTextInTree, true);

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "bob",
      password: "Bb!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/ui/preferences/display", {
      display: {
        theme: "dim",
        treeQuestionColor: "#ff0000",
        treeQuestionSizePx: 20,
        showQuestionTextInTree: true
      }
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.canManageTree, false);
    assert.equal(response.json.display.theme, "dim");
    assert.equal(Object.prototype.hasOwnProperty.call(response.json.display, "treeQuestionColor"), false);

    response = await request("GET", "/api/ui/preferences/display");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.canManageTree, false);
    assert.equal(response.json.display.theme, "dim");
    assert.equal(Object.prototype.hasOwnProperty.call(response.json.display, "treeQuestionColor"), false);

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/ui/preferences/display");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.canManageTree, true);
    assert.equal(response.json.display.theme, "black");
    assert.equal(response.json.display.treeQuestionColor, "#112233");
    assert.equal(response.json.display.showQuestionTextInTree, true);
  });
});

test("solution search: fuzzy matching, ranking, pagination, and restricted result filtering", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "SearchLab",
      question: "Search test topic?"
    });
    assert.equal(response.status, 200);

    await createSolutionNode(request, "SearchLab", "WiFi", "<p>Primary wireless troubleshooting path.</p>");
    await createSolutionNode(request, "SearchLab", "OfficeWiFiSetup", "<p>Use office profile for Wi-Fi setup.</p>");
    await createSolutionNode(request, "SearchLab", "CableGuide", "<p>If wifi is unstable, use a wired fallback.</p>");
    await createSolutionNode(request, "SearchLab", "Wired", "<p>Plug in an ethernet cable and retry.</p>");

    for (let i = 1; i <= 26; i += 1) {
      const index = String(i).padStart(2, "0");
      const answerName = "Alpha" + index;
      await createSolutionNode(request, "SearchLab", answerName, `<p>alpha token ${index}</p>`);
    }

    await createSolutionNode(request, "SearchLab", "HiddenAlpha", "<p>secretalpha confidential workflow</p>");

    response = await request("POST", "/api/superadmin/flags/", {
      name: ".admin_only",
      message: "Admins only",
      colorClass: "#dc3545",
      restrictionType: "roles",
      allowedRoles: ["admin", "superadmin"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("PUT", "/api/admin/solution/flags?path=SearchLab%2FHiddenAlpha", {
      flagNames: [".admin_only"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/search?q=wifi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.results));
    assert.equal(response.json.results[0].label, "WiFi");
    assert.equal(response.json.results[1].label, "OfficeWiFiSetup");
    const cableGuideIndex = response.json.results.findIndex((entry) => entry.label === "CableGuide");
    assert.ok(cableGuideIndex >= 2);
    assert.match(response.json.results[0].snippet, /wireless/i);

    response = await request("GET", "/api/search?q=wireless");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(response.json.results.some((entry) => entry.label === "WiFi"));

    response = await request("GET", "/api/admin/solution?path=SearchLab%2FWiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("PUT", "/api/admin/solution?path=SearchLab%2FWiFi", {
      content: "<p>Ethernet-only fallback instructions.</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/search?q=wireless");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.results.some((entry) => entry.label === "WiFi"), false);

    response = await request("GET", "/api/search?q=wird");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(response.json.results.length >= 1);
    assert.equal(response.json.results[0].label, "Wired");

    response = await request("GET", "/api/search?q=alpha");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.pageSize, 25);
    assert.equal(response.json.results.length, 25);
    assert.ok(response.json.total >= 27);
    assert.ok(response.json.hasNextPage);

    response = await request("GET", "/api/search?q=alpha&page=2");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.page, 2);
    assert.ok(response.json.results.length >= 1);
    assert.ok(response.json.hasPrevPage);

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("GET", "/api/search?q=secretalpha");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.total, 0);
    assert.equal(response.json.results.length, 0);
  });
});

test("superadmin flag settings: custom tags, role/user restriction, and reserved lock name", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/ui/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.uiSettings.autoContrastFlagBackground, true);
    assert.equal(response.json.uiSettings.autoContrastStrictness, 4.5);

    response = await request("POST", "/api/superadmin/flags/settings", {
      autoContrastFlagBackground: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.uiSettings.autoContrastFlagBackground, false);
    assert.equal(response.json.uiSettings.autoContrastStrictness, 4.5);

    response = await request("GET", "/api/ui/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.uiSettings.autoContrastFlagBackground, false);
    assert.equal(response.json.uiSettings.autoContrastStrictness, 4.5);

    response = await request("POST", "/api/superadmin/flags/settings", {
      autoContrastStrictness: 3.2
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.uiSettings.autoContrastStrictness, 3.2);

    response = await request("GET", "/api/ui/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.uiSettings.autoContrastStrictness, 3.2);

    response = await request("POST", "/api/superadmin/flags/settings", {
      autoContrastFlagBackground: "bad"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/superadmin/flags/settings", {
      autoContrastStrictness: "bad"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/admin/topic", {
      name: "VPN",
      question: "VPN issue?"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "VPN",
      answerName: "Reset",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/admin/solution?path=VPN/Reset");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=VPN/Reset", {
      content: "<p>Try restarting the VPN client.</p>"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/flags/", {
      name: ".admin_only",
      message: "Admins only",
      colorClass: "#dc3545",
      backgroundColor: "#111111",
      iconClass: "bi-shield-lock",
      restrictionType: "roles",
      allowedRoles: ["admin", "superadmin"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.flag.name, ".admin_only");
    assert.equal(response.json.flag.iconClass, "bi-shield-lock");
    assert.equal(response.json.flag.backgroundColor, "#111111");

    response = await request("PUT", "/api/admin/solution/flags?path=VPN/Reset", {
      flagNames: [".admin_only"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/node?path=VPN/Reset");
    assert.equal(response.status, 200);
    assert.equal(response.json.type, "terminal");
    assert.equal(response.json.restricted, false);
    assert.equal(response.json.flags.length, 1);
    assert.equal(response.json.flags[0].name, ".admin_only");
    assert.equal(response.json.flags[0].iconClass, "bi-shield-lock");
    assert.equal(response.json.flags[0].backgroundColor, "#111111");

    response = await request("POST", "/api/superadmin/users/", {
      username: "viewer",
      password: "Vv!23456",
      role: "user"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "viewer",
      password: "Vv!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/flags/settings", {
      autoContrastFlagBackground: true
    });
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    response = await request("GET", "/api/node?path=VPN/Reset");
    assert.equal(response.status, 200);
    assert.equal(response.json.type, "terminal");
    assert.equal(response.json.restricted, true);
    assert.equal(response.json.blockingFlag.name, ".admin_only");
    assert.match(response.json.message, /admins only/i);

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/flags/update", {
      existingName: ".admin_only",
      name: ".named_users",
      message: "Named users only",
      colorClass: "#0dcaf0",
      backgroundColor: "#1f2937",
      iconClass: "bi-person-lock",
      restrictionType: "users",
      allowedUsers: ["viewer"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.flag.name, ".named_users");
    assert.equal(response.json.flag.iconClass, "bi-person-lock");
    assert.equal(response.json.flag.backgroundColor, "#1f2937");

    response = await request("POST", "/api/superadmin/flags/", {
      name: ".lock",
      message: "Should fail",
      colorClass: "#ffc107",
      restrictionType: "none"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/superadmin/flags/", {
      name: ".bad_color",
      message: "Should fail",
      colorClass: "not-a-color",
      restrictionType: "none"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/superadmin/flags/", {
      name: ".bad_icon",
      message: "Should fail",
      colorClass: "#ffc107",
      iconClass: "bi-not-a-real-icon",
      restrictionType: "none"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/superadmin/flags/", {
      name: ".bad_bg",
      message: "Should fail",
      colorClass: "#ffc107",
      backgroundColor: "not-a-color",
      restrictionType: "none"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "viewer",
      password: "Vv!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/node?path=VPN/Reset");
    assert.equal(response.status, 200);
    assert.equal(response.json.type, "terminal");
    assert.equal(response.json.restricted, false);
    assert.equal(response.json.flags[0].name, ".named_users");
    assert.equal(response.json.flags[0].iconClass, "bi-person-lock");
    assert.equal(response.json.flags[0].backgroundColor, "#1f2937");

    response = await request("POST", "/api/auth/logout");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/flags/delete", {
      name: ".named_users"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/node?path=VPN/Reset");
    assert.equal(response.status, 200);
    assert.equal(response.json.type, "terminal");
    assert.equal(response.json.restricted, false);
    assert.equal(Array.isArray(response.json.flags), true);
    assert.equal(response.json.flags.length, 0);
  });
});


test("admin version history supports rollback for questions and solutions", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "HistoryTopic",
      question: "Initial question?"
    });
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/question?path=HistoryTopic", {
      question: "Updated question?"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/history?path=HistoryTopic");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.nodeType, "question");
    assert.ok(Array.isArray(response.json.versions));
    assert.ok(response.json.versions.length >= 1);

    const questionHistoryCountBeforeRollback = response.json.versions.length;
    const questionVersion = response.json.versions.find((entry) =>
      String(entry.contentPreview || "").toLowerCase().includes("initial question")
    );
    assert.ok(questionVersion);

    response = await request("POST", "/api/admin/history/rollback", {
      path: "HistoryTopic",
      versionId: questionVersion.id
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.nodeType, "question");

    response = await request("GET", "/api/admin/history?path=HistoryTopic");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.versions.length, questionHistoryCountBeforeRollback);

    response = await request("GET", "/api/admin/question?path=HistoryTopic");
    assert.equal(response.status, 200);
    assert.match(response.json.question, /Initial question\?/);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "HistoryTopic",
      answerName: "WiFi",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/admin/solution?path=HistoryTopic/WiFi");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=HistoryTopic/WiFi", {
      content: "<p>First version</p>"
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/admin/solution?path=HistoryTopic/WiFi");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=HistoryTopic/WiFi", {
      content: "<p>Second version</p>"
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/admin/history?path=HistoryTopic/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.nodeType, "solution");
    assert.ok(Array.isArray(response.json.versions));
    assert.ok(response.json.versions.length >= 1);

    const solutionHistoryCountBeforeRollback = response.json.versions.length;
    const solutionVersion = response.json.versions.find((entry) =>
      String(entry.contentPreview || "").toLowerCase().includes("first version")
    );
    assert.ok(solutionVersion);

    response = await request("POST", "/api/admin/history/rollback", {
      path: "HistoryTopic/WiFi",
      versionId: solutionVersion.id
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.nodeType, "solution");

    response = await request("GET", "/api/admin/history?path=HistoryTopic/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.versions.length, solutionHistoryCountBeforeRollback);

    const solutionHistoryCountBeforeDelete = response.json.versions.length;
    response = await request("POST", "/api/admin/history/delete", {
      path: "HistoryTopic/WiFi",
      versionId: solutionVersion.id
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.nodeType, "solution");

    response = await request("GET", "/api/admin/history?path=HistoryTopic/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.versions.length, Math.max(0, solutionHistoryCountBeforeDelete - 1));
    assert.equal(response.json.versions.some((entry) => entry.id === solutionVersion.id), false);

    response = await request("GET", "/api/node?path=HistoryTopic/WiFi");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.type, "terminal");
    assert.match(response.json.solutionHtml, /First version/);
  });
});


test("solution approval workflow: submit, reject, approve, supersede, and flag gating", async () => {
  await withServer({ authMode: "optional" }, async ({ request, baseUrl }) => {
    const superadmin = request;
    const approver = createRequestClient(baseUrl);
    const submitter = createRequestClient(baseUrl);
    const secondSubmitter = createRequestClient(baseUrl);

    let response;

    response = await superadmin("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await superadmin("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.user.canApprove, true);

    response = await superadmin("GET", "/api/superadmin/approvals/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.settings.flagEditsRequireApproval, false);

    response = await superadmin("POST", "/api/superadmin/users/", {
      username: "approver1",
      password: "Bb!23456",
      role: "admin",
      canApprove: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await superadmin("POST", "/api/superadmin/users/", {
      username: "editor1",
      password: "Cc!23456",
      role: "admin",
      canApprove: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await superadmin("POST", "/api/superadmin/users/", {
      username: "editor2",
      password: "Dd!23456",
      role: "admin",
      canApprove: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await superadmin("POST", "/api/superadmin/users/", {
      username: "viewer1",
      password: "Ee!23456",
      role: "user",
      canApprove: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await superadmin("GET", "/api/superadmin/users/");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    const viewerUser = response.json.users.find((entry) => entry.username === "viewer1");
    assert.ok(viewerUser);
    assert.equal(viewerUser.role, "user");
    assert.equal(viewerUser.canApprove, false);

    response = await approver("POST", "/api/auth/login", {
      username: "approver1",
      password: "Bb!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.user.canApprove, true);

    response = await approver("GET", "/api/auth/me");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.user.canApprove, true);

    response = await submitter("POST", "/api/auth/login", {
      username: "editor1",
      password: "Cc!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.user.canApprove, false);

    response = await secondSubmitter("POST", "/api/auth/login", {
      username: "editor2",
      password: "Dd!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.user.canApprove, false);

    response = await superadmin("POST", "/api/admin/topic", {
      name: "Approvals",
      question: "What do you need?"
    });
    assert.equal(response.status, 200);

    response = await superadmin("POST", "/api/admin/answer", {
      parentPath: "Approvals",
      answerName: "Case1",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    await openSolutionForEdit(superadmin, "Approvals/Case1");
    response = await superadmin("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Published v1</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.mode, "published");

    response = await submitter("POST", "/api/admin/upload-image?path=Approvals%2FCase1", {});
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    response = await submitter("POST", "/api/admin/solution/images/delete", {
      path: "Approvals/Case1",
      filename: "old.png"
    });
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    await openSolutionForEdit(submitter, "Approvals/Case1");
    response = await submitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Pending v1</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.mode, "pending-submitted");
    const firstPendingId = response.json.submissionId;
    assert.ok(firstPendingId);

    response = await submitter("GET", "/api/admin/reviews/pending");
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    response = await submitter("GET", "/api/node?path=Approvals/Case1");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.type, "terminal");
    assert.match(String(response.json.solutionHtml || ""), /Published v1/);
    assert.doesNotMatch(String(response.json.solutionHtml || ""), /Pending v1/);

    await openSolutionForEdit(submitter, "Approvals/Case1");
    response = await submitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Pending v2</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.mode, "pending-updated");
    assert.equal(response.json.submissionId, firstPendingId);

    await openSolutionForEdit(secondSubmitter, "Approvals/Case1");
    response = await secondSubmitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Blocked pending</p>"
    });
    assert.equal(response.status, 409);
    assert.equal(response.json.ok, false);
    assert.equal(response.json.blocked, true);
    assert.equal(response.json.pendingOwner, "editor1");

    response = await secondSubmitter("POST", "/api/admin/lock/release", {
      path: "Approvals/Case1",
      type: "solution"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await approver("GET", "/api/admin/reviews/pending");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.submissions));
    assert.ok(response.json.submissions.some((entry) => entry.id === firstPendingId));

    response = await approver("POST", "/api/admin/reviews/submissions/" + encodeURIComponent(firstPendingId) + "/reject", {
      reason: ""
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await approver("POST", "/api/admin/reviews/submissions/" + encodeURIComponent(firstPendingId) + "/reject", {
      reason: "Needs more detail."
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.submission.status, "rejected");

    response = await submitter("GET", "/api/admin/reviews/solution-status?path=Approvals/Case1");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.status.ownRejected.status, "rejected");
    assert.equal(response.json.status.ownRejected.reviewReason, "Needs more detail.");

    response = await submitter("GET", "/api/admin/reviews/mine?status=pending,rejected&limit=100");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(response.json.submissions.some((entry) => entry.id === firstPendingId && entry.status === "rejected"));

    response = await submitter("GET", "/api/admin/reviews/mine/" + encodeURIComponent(firstPendingId));
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.submission.id, firstPendingId);

    await openSolutionForEdit(submitter, "Approvals/Case1");
    response = await submitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Ready for approval</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.mode, "pending-submitted");
    const approvalId = response.json.submissionId;
    assert.ok(approvalId);
    assert.notEqual(approvalId, firstPendingId);

    response = await approver("POST", "/api/admin/reviews/submissions/" + encodeURIComponent(approvalId) + "/approve", {});
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.submission.status, "approved");

    response = await submitter("GET", "/api/node?path=Approvals/Case1");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.match(String(response.json.solutionHtml || ""), /Ready for approval/);

    await openSolutionForEdit(submitter, "Approvals/Case1");
    response = await submitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Withdraw me</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    const withdrawId = response.json.submissionId;

    response = await approver("POST", "/api/admin/reviews/submissions/" + encodeURIComponent(withdrawId) + "/withdraw", {});
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    response = await submitter("POST", "/api/admin/reviews/submissions/" + encodeURIComponent(withdrawId) + "/withdraw", {});
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.submission.status, "withdrawn");

    await openSolutionForEdit(submitter, "Approvals/Case1");
    response = await submitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Will be superseded</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    const supersedeTargetId = response.json.submissionId;

    await openSolutionForEdit(approver, "Approvals/Case1");
    response = await approver("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Approver direct publish</p>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.mode, "published");

    response = await approver("GET", "/api/admin/reviews/submissions/" + encodeURIComponent(supersedeTargetId));
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.submission.status, "superseded");

    response = await submitter("GET", "/api/node?path=Approvals/Case1");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.match(String(response.json.solutionHtml || ""), /Approver direct publish/);
    assert.doesNotMatch(String(response.json.solutionHtml || ""), /Will be superseded/);

    response = await superadmin("POST", "/api/superadmin/flags/", {
      name: ".review",
      message: "Under review",
      colorClass: "#0d6efd",
      iconClass: "bi-eye",
      restrictionType: "none"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await superadmin("POST", "/api/superadmin/approvals/settings", {
      flagEditsRequireApproval: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.settings.flagEditsRequireApproval, true);

    response = await submitter("PUT", "/api/admin/solution/flags?path=Approvals%2FCase1", {
      flagNames: [".review"]
    });
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    const inlineImage = "data:image/png;base64,"
      + "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7l8n8AAAAASUVORK5CYII=";

    await openSolutionForEdit(submitter, "Approvals/Case1");
    response = await submitter("PUT", "/api/admin/solution?path=Approvals%2FCase1", {
      content: "<p>Approved with inline image</p><p><img src=\"" + inlineImage + "\" alt=\"dot\"></p>",
      pendingFlags: [".review"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    const flaggedApprovalId = response.json.submissionId;

    response = await approver("POST", "/api/admin/reviews/submissions/" + encodeURIComponent(flaggedApprovalId) + "/approve", {});
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Number(response.json.materializedImages) >= 1);

    response = await submitter("GET", "/api/node?path=Approvals/Case1");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.match(String(response.json.solutionHtml || ""), /\/api\/asset\//);
    assert.doesNotMatch(String(response.json.solutionHtml || ""), /data:image/);
    assert.ok(Array.isArray(response.json.flags));
    assert.ok(response.json.flags.some((entry) => entry && entry.name === ".review"));

    response = await superadmin("POST", "/api/superadmin/approvals/settings", {
      flagEditsRequireApproval: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.settings.flagEditsRequireApproval, false);

    response = await submitter("PUT", "/api/admin/solution/flags?path=Approvals%2FCase1", {
      flagNames: []
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await submitter("GET", "/api/node?path=Approvals/Case1");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.flags));
    assert.equal(response.json.flags.length, 0);
  });
});

test("admin integrity scan: reports broken local images and unreachable nodes", async () => {
  await withServer({ authMode: "optional" }, async ({ request, tempRoot }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "IntegrityTopic",
      question: "Where is the issue?"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "IntegrityTopic",
      answerName: "GoodSolution",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/admin/solution?path=IntegrityTopic%2FGoodSolution");
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "IntegrityDefaultQuestion",
      question: "New question"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "IntegrityDefaultSolution",
      question: "Solution defaults"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "IntegrityDefaultSolution",
      answerName: "KeepDefault",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "IntegrityTopic",
      answerName: "EmptySolution",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=IntegrityTopic%2FGoodSolution", {
      content: '<p>Check images.</p><img src="/api/asset/IntegrityTopic/GoodSolution/missing.png" /><img src="missing-local.png" />'
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/solution?path=IntegrityTopic%2FEmptySolution");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=IntegrityTopic%2FEmptySolution", {
      content: "<div>   </div>"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    await fs.mkdir(path.join(tempRoot, "data", "Knowledgebase", "IntegrityTopic", "GoodSolution", "OrphanChild"), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, "data", "Knowledgebase", "IntegrityTopic", "GoodSolution", "OrphanChild", "question.txt"),
      "Should never be reachable.\n",
      "utf8"
    );

    await fs.mkdir(path.join(tempRoot, "data", "Knowledgebase", "IntegrityTopic", "MissingContent"), { recursive: true });

    const mixedPath = path.join(tempRoot, "data", "Knowledgebase", "IntegrityTopic", "MixedNode");
    await fs.mkdir(mixedPath, { recursive: true });
    await fs.writeFile(path.join(mixedPath, "question.txt"), "Mixed question\n", "utf8");
    await fs.writeFile(path.join(mixedPath, "solution.html"), "<p>Mixed solution</p>\n", "utf8");

    const emptyQuestionPath = path.join(tempRoot, "data", "Knowledgebase", "IntegrityEmptyQuestion");
    await fs.mkdir(emptyQuestionPath, { recursive: true });
    await fs.writeFile(path.join(emptyQuestionPath, "question.txt"), "   \n\t", "utf8");

    let caseCollisionSupported = false;
    const casePathA = path.join(tempRoot, "data", "Knowledgebase", "IntegrityTopic", "CaseNode");
    const casePathB = path.join(tempRoot, "data", "Knowledgebase", "IntegrityTopic", "casenode");
    await fs.mkdir(casePathA, { recursive: true });
    await fs.writeFile(path.join(casePathA, "question.txt"), "Case A\n", "utf8");
    try {
      await fs.mkdir(casePathB, { recursive: false });
      await fs.writeFile(path.join(casePathB, "question.txt"), "Case B\n", "utf8");
      caseCollisionSupported = true;
    } catch (error) {
      if (!error || !["EEXIST", "EPERM", "EACCES"].includes(error.code)) {
        throw error;
      }
    }

    response = await request("GET", "/api/admin/integrity/scan?force=true");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    assert.ok(response.json.summary.brokenImageRefs >= 2);
    assert.ok(response.json.summary.unreachableNodes >= 2);
    assert.ok(response.json.summary.defaultQuestionTextNodes >= 1);
    assert.ok(response.json.summary.questionNodesWithoutAnswers >= 1);
    assert.ok(response.json.summary.defaultSolutionContentNodes >= 1);
    assert.ok(response.json.summary.mixedContentNodes >= 1);
    assert.ok(response.json.summary.emptyQuestionNodes >= 1);
    assert.ok(response.json.summary.emptySolutionNodes >= 1);
    assert.equal(typeof response.json.summary.caseCollisionNodes, "number");

    const brokenByPath = (response.json.brokenImages || []).filter((entry) => entry.path === "IntegrityTopic/GoodSolution");
    assert.ok(brokenByPath.length >= 2);

    const defaultQuestions = (response.json.defaultQuestionNodes || []).map((entry) => entry.path);
    assert.ok(defaultQuestions.includes("IntegrityDefaultQuestion"));

    const noAnswerNodes = (response.json.noAnswerNodes || []).map((entry) => entry.path);
    assert.ok(noAnswerNodes.includes("IntegrityDefaultQuestion"));

    const mixedNodes = (response.json.mixedContentNodes || []).map((entry) => entry.path);
    assert.ok(mixedNodes.includes("IntegrityTopic/MixedNode"));

    const emptyQuestionNodes = (response.json.emptyQuestionNodes || []).map((entry) => entry.path);
    assert.ok(emptyQuestionNodes.includes("IntegrityEmptyQuestion"));

    const emptySolutionNodes = (response.json.emptySolutionNodes || []).map((entry) => entry.path);
    assert.ok(emptySolutionNodes.includes("IntegrityTopic/EmptySolution"));

    const unreachablePaths = new Set((response.json.unreachableNodes || []).map((entry) => entry.path));
    assert.equal(unreachablePaths.has("IntegrityTopic/GoodSolution/OrphanChild"), true);
    assert.equal(unreachablePaths.has("IntegrityTopic/MissingContent"), true);

    const issueMap = response.json.issuesByPath || {};
    assert.ok(issueMap["IntegrityTopic/GoodSolution"]);
    assert.ok(Number(issueMap["IntegrityTopic/GoodSolution"].brokenImageCount || 0) >= 2);
    assert.equal(Boolean(issueMap["IntegrityDefaultQuestion"] && issueMap["IntegrityDefaultQuestion"].defaultQuestion), true);
    assert.equal(Boolean(issueMap["IntegrityDefaultQuestion"] && issueMap["IntegrityDefaultQuestion"].noAnswers), true);
    assert.equal(Boolean(issueMap["IntegrityDefaultSolution/KeepDefault"] && issueMap["IntegrityDefaultSolution/KeepDefault"].defaultSolution), true);
    assert.equal(Boolean(issueMap["IntegrityTopic/MixedNode"] && issueMap["IntegrityTopic/MixedNode"].mixedContent), true);
    assert.equal(Boolean(issueMap["IntegrityEmptyQuestion"] && issueMap["IntegrityEmptyQuestion"].emptyQuestion), true);
    assert.equal(Boolean(issueMap["IntegrityTopic/EmptySolution"] && issueMap["IntegrityTopic/EmptySolution"].emptySolution), true);

    if (caseCollisionSupported) {
      assert.ok(response.json.summary.caseCollisionNodes >= 2);
      const caseNodes = new Set((response.json.caseCollisionNodes || []).map((entry) => entry.path));
      assert.equal(caseNodes.has("IntegrityTopic/CaseNode"), true);
      assert.equal(caseNodes.has("IntegrityTopic/casenode"), true);
      assert.ok(Array.isArray(issueMap["IntegrityTopic/CaseNode"].caseCollisionSiblings));
      assert.ok(Array.isArray(issueMap["IntegrityTopic/casenode"].caseCollisionSiblings));
    }

    assert.ok(Array.isArray(response.json.historyRows));
    const historyRowsFirstScan = response.json.historyRows;
    const firstScanPaths = new Set(historyRowsFirstScan.map((entry) => String(entry.path || "")));
    assert.equal(firstScanPaths.size, historyRowsFirstScan.length);
    assert.ok(historyRowsFirstScan.length > 0);

    const foundAtByPathFirstScan = Object.fromEntries(
      historyRowsFirstScan.map((entry) => [String(entry.path || ""), String(entry.foundAt || "")])
    );

    response = await request("GET", "/api/admin/integrity/scan?force=true");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.historyRows));
    assert.equal(response.json.historyRows.length, historyRowsFirstScan.length);
    response.json.historyRows.forEach((entry) => {
      const pathKey = String(entry.path || "");
      assert.equal(String(entry.foundAt || ""), String(foundAtByPathFirstScan[pathKey] || ""));
    });

    response = await request("PUT", "/api/admin/question?path=IntegrityDefaultQuestion", {
      question: "Updated question text"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    await new Promise((resolve) => setTimeout(resolve, 20));

    response = await request("GET", "/api/admin/integrity/scan?force=true");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.historyRows));

    const defaultQuestionHistoryRow = response.json.historyRows.find((entry) => entry.path === "IntegrityDefaultQuestion");
    assert.ok(defaultQuestionHistoryRow);
    assert.notEqual(
      String(defaultQuestionHistoryRow.foundAt || ""),
      String(foundAtByPathFirstScan["IntegrityDefaultQuestion"] || "")
    );

    response = await request("POST", "/api/admin/answer", {
      parentPath: "IntegrityDefaultQuestion",
      answerName: "NowHasAnswer",
      kind: "solution"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/integrity/scan?force=true");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.historyRows));
    assert.equal(response.json.historyRows.some((entry) => entry.path === "IntegrityDefaultQuestion"), false);

    response = await request("DELETE", "/api/admin/integrity/history");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Number(response.json.clearedCount || 0) > 0);
    assert.ok(Array.isArray(response.json.historyRows));
    assert.equal(response.json.historyRows.length, 0);
    assert.equal(response.json.summary, null);
    assert.equal(response.json.generatedAt, "");

    response = await request("GET", "/api/admin/integrity/scan?force=false");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.summary, null);
    assert.equal(response.json.generatedAt, "");
    assert.ok(Array.isArray(response.json.historyRows));
    assert.equal(response.json.historyRows.length, 0);

    const historyFilePath = path.join(tempRoot, "data", "integrity-history.json");
    const historyFileRaw = await fs.readFile(historyFilePath, "utf8");
    const historyDoc = JSON.parse(historyFileRaw);
    const persistedRows = Array.isArray(historyDoc && historyDoc.rows) ? historyDoc.rows : [];
    assert.equal(persistedRows.length, 0);

    response = await request("GET", "/api/admin/integrity/scan?force=true");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(Array.isArray(response.json.historyRows));
    assert.ok(response.json.historyRows.length > 0);
  });
});


test("admin batch delete/convert, question move, and trash bulk restore/purge", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "Source",
      question: "Source question?"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "Destination",
      question: "Destination question?"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "Source",
      answerName: "MoveMe",
      kind: "question"
    });
    assert.equal(response.status, 200);

    await createSolutionNode(request, "Source/MoveMe", "Leaf", "<p>Leaf solution</p>");

    response = await request("POST", "/api/admin/move-question", {
      sourcePath: "Source/MoveMe",
      destinationParentPath: "Destination"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.path, "Destination/MoveMe");

    response = await request("GET", "/api/node?path=Destination%2FMoveMe%2FLeaf");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.type, "terminal");

    response = await request("POST", "/api/admin/batch-convert", {
      mode: "solution-to-question",
      paths: ["Destination/MoveMe/Leaf"],
      questionText: "Converted question"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.convertedCount, 1);

    response = await request("GET", "/api/node?path=Destination%2FMoveMe%2FLeaf");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.type, "node");

    response = await request("POST", "/api/admin/batch-convert", {
      mode: "question-to-solution",
      paths: ["Destination/MoveMe/Leaf"]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.convertedCount, 1);

    response = await request("GET", "/api/node?path=Destination%2FMoveMe%2FLeaf");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.type, "terminal");

    response = await request("POST", "/api/admin/answer", {
      parentPath: "Source",
      answerName: "DeleteMe",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/batch-delete", {
      items: [
        { type: "solution", path: "Source/DeleteMe" },
        { type: "question", path: "Destination/MoveMe" }
      ]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.deletedCount, 2);

    const deleteResults = Array.isArray(response.json.results) ? response.json.results : [];
    const deletedSolution = deleteResults.find((entry) => entry.path === "Source/DeleteMe" && entry.status === "deleted");
    const deletedQuestion = deleteResults.find((entry) => entry.path === "Destination/MoveMe" && entry.status === "deleted");
    assert.ok(deletedSolution && deletedSolution.trashPath);
    assert.ok(deletedQuestion && deletedQuestion.trashPath);

    response = await request("POST", "/api/admin/answer", {
      parentPath: "Source",
      answerName: "DeleteMe",
      kind: "solution"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/trash/restore-plan", {
      trashPaths: [deletedSolution.trashPath],
      mode: "original"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(Array.isArray(response.json.rows), true);
    assert.equal(response.json.rows.length, 1);
    assert.equal(Boolean(response.json.rows[0] && response.json.rows[0].conflict && response.json.rows[0].conflict.exists), true);

    response = await request("POST", "/api/admin/trash/restore-bulk", {
      mode: "original",
      entries: [
        {
          trashPath: deletedSolution.trashPath,
          action: "auto-rename"
        }
      ]
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.restoredCount, 1);

    response = await request("POST", "/api/admin/trash/purge-bulk", {
      trashPaths: [deletedQuestion.trashPath],
      confirm: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.purgedCount, 1);


  });
});
test("superadmin backups: manual run, restore, and access control", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "BackupTopic",
      question: "Backup question?"
    });
    assert.equal(response.status, 200);

    await createSolutionNode(request, "BackupTopic", "Original", "<p>Version A</p>");

    response = await request("GET", "/api/superadmin/backups/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.settings.scope, "data+config");

    response = await request("POST", "/api/superadmin/backups/settings", {
      scheduleEnabled: true,
      schedulePreset: "daily-02:00",
      retentionMode: "count+age",
      keepLast: 14,
      maxAgeDays: 30,
      includeConfig: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.settings.scheduleEnabled, true);
    assert.equal(typeof response.json.runtime.nextRunAt, "string");

    response = await request("POST", "/api/superadmin/backups/run", { label: "integration-backup" });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const backupRunId = response.json.runId;
    const backupRun = await waitForBackupRunComplete(request, backupRunId);
    assert.equal(backupRun.status, "completed");
    assert.ok(backupRun.archiveId);

    response = await request("GET", "/api/admin/solution?path=BackupTopic/Original");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=BackupTopic/Original", {
      content: "<p>Version B</p>"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/backups/restore", {
      sourceType: "existing",
      archiveId: backupRun.archiveId,
      typedConfirm: "NOPE"
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/superadmin/backups/restore", {
      sourceType: "existing",
      archiveId: backupRun.archiveId,
      typedConfirm: "RESTORE"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const restoreRunId = response.json.runId;
    const restoreRun = await waitForBackupRunComplete(request, restoreRunId, 24000);
    assert.equal(restoreRun.status, "completed");
    assert.ok(restoreRun.safetySnapshotRunId);

    response = await request("GET", "/api/node?path=BackupTopic/Original");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.match(response.json.solutionHtml, /Version A/);

    response = await request("POST", "/api/superadmin/users/", {
      username: "alice",
      password: "Bb!23456",
      role: "admin"
    });
    assert.equal(response.status, 200);

    await request("POST", "/api/auth/logout", {});

    response = await request("POST", "/api/auth/login", {
      username: "alice",
      password: "Bb!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("GET", "/api/superadmin/backups/settings");
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);
  });
});


test("superadmin backups: retention count-only prunes older manual archives", async () => {
  await withServer({ authMode: "optional" }, async ({ request }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "RetentionTopic",
      question: "Retention question?"
    });
    assert.equal(response.status, 200);

    await createSolutionNode(request, "RetentionTopic", "Leaf", "<p>Retention A</p>");

    response = await request("POST", "/api/superadmin/backups/settings", {
      scheduleEnabled: false,
      schedulePreset: "daily-02:00",
      retentionMode: "count-only",
      keepLast: 1,
      maxAgeDays: 3650,
      includeConfig: true
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/backups/run", { label: "retention-1" });
    assert.equal(response.status, 200);
    const firstRun = await waitForBackupRunComplete(request, response.json.runId);
    assert.equal(firstRun.status, "completed");
    response = await request("GET", "/api/admin/solution?path=RetentionTopic/Leaf");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=RetentionTopic/Leaf", { content: "<p>Retention B</p>" });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/backups/run", { label: "retention-2" });
    assert.equal(response.status, 200);
    const secondRun = await waitForBackupRunComplete(request, response.json.runId);
    assert.equal(secondRun.status, "completed");

    response = await request("GET", "/api/superadmin/backups/runs?limit=50");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const keptManualBackups = response.json.runs.filter((run) => (
      run
      && run.type === "backup"
      && run.trigger === "manual"
      && run.status === "completed"
    ));

    assert.equal(keptManualBackups.length, 1);
    assert.equal(keptManualBackups[0].id, secondRun.id);

    response = await request("GET", `/api/superadmin/backups/download/${encodeURIComponent(firstRun.archiveId)}`);
    assert.equal(response.status, 404);
  });
});

test("superadmin backups: concurrency guard, SSE stream, and upload restore validation", async () => {
  await withServer({ authMode: "optional" }, async ({ request, baseUrl }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "UploadTopic",
      question: "Upload question?"
    });
    assert.equal(response.status, 200);

    await createSolutionNode(request, "UploadTopic", "Leaf", "<p>Upload A</p>");

    response = await request("POST", "/api/superadmin/backups/run", { label: "upload-base" });
    assert.equal(response.status, 200);
    const runId = response.json.runId;

    const concurrent = await request("POST", "/api/superadmin/backups/run", { label: "concurrent" });
    assert.equal(concurrent.status, 400);
    assert.equal(concurrent.json.ok, false);

    const ssePromise = fetch(`${baseUrl}/api/superadmin/backups/runs/${encodeURIComponent(runId)}/stream`, {
      method: "GET",
      headers: {
        accept: "text/event-stream",
        cookie: request.getCookie() || ""
      }
    }).then(async (res) => {
      assert.equal(res.status, 200);
      return res.text();
    });

    const baseRun = await waitForBackupRunComplete(request, runId);
    assert.equal(baseRun.status, "completed");
    assert.ok(baseRun.archiveId);

    const sseText = await ssePromise;
    assert.match(sseText, /event: snapshot/);
    assert.match(sseText, /event: complete/);

    const downloadRes = await fetch(`${baseUrl}/api/superadmin/backups/download/${encodeURIComponent(baseRun.archiveId)}`, {
      method: "GET",
      headers: {
        cookie: request.getCookie() || ""
      }
    });
    assert.equal(downloadRes.status, 200);
    const downloadBytes = Buffer.from(await downloadRes.arrayBuffer());
    response = await request("GET", "/api/admin/solution?path=UploadTopic/Leaf");
    assert.equal(response.status, 200);

    response = await request("PUT", "/api/admin/solution?path=UploadTopic/Leaf", {
      content: "<p>Upload B</p>"
    });
    assert.equal(response.status, 200);

    const uploadForm = new FormData();
    uploadForm.append("sourceType", "upload");
    uploadForm.append("typedConfirm", "RESTORE");
    uploadForm.append("archive", new Blob([downloadBytes], { type: "application/zip" }), "backup.zip");

    const uploadRestoreRes = await fetch(`${baseUrl}/api/superadmin/backups/restore`, {
      method: "POST",
      headers: {
        cookie: request.getCookie() || ""
      },
      body: uploadForm
    });
    assert.equal(uploadRestoreRes.status, 200);
    const uploadRestoreJson = await uploadRestoreRes.json();
    assert.equal(uploadRestoreJson.ok, true);

    const uploadRestoreRun = await waitForBackupRunComplete(request, uploadRestoreJson.runId, 25000);
    assert.equal(uploadRestoreRun.status, "completed");

    response = await request("GET", "/api/node?path=UploadTopic/Leaf");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.match(response.json.solutionHtml, /Upload A/);

    const maliciousArchive = await createZipBuffer([
      { name: "manifest.json", content: JSON.stringify({ schemaVersion: 1 }) },
      { name: "notes.txt", content: "missing required restore paths" }
    ]);

    const badForm = new FormData();
    badForm.append("sourceType", "upload");
    badForm.append("typedConfirm", "RESTORE");
    badForm.append("archive", new Blob([maliciousArchive], { type: "application/zip" }), "malicious.zip");

    const badRestoreRes = await fetch(`${baseUrl}/api/superadmin/backups/restore`, {
      method: "POST",
      headers: {
        cookie: request.getCookie() || ""
      },
      body: badForm
    });
    assert.equal(badRestoreRes.status, 200);
    const badRestoreJson = await badRestoreRes.json();
    assert.equal(badRestoreJson.ok, true);

    const badRun = await waitForBackupRunComplete(request, badRestoreJson.runId, 25000);
    assert.equal(badRun.status, "failed");
    assert.match(String(badRun.errorMessage || ""), /manifest|knowledgebase|data|restore/i);
  });
});


test("superadmin backups: scheduled run executes when due", async () => {
  await withServer({ authMode: "optional", backupSchedulerTickSeconds: 1 }, async ({ request, backupService }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/topic", {
      name: "ScheduledTopic",
      question: "Scheduled question?"
    });
    assert.equal(response.status, 200);
    await createSolutionNode(request, "ScheduledTopic", "Leaf", "<p>Scheduled</p>");

    response = await request("POST", "/api/superadmin/backups/settings", {
      scheduleEnabled: true,
      schedulePreset: "hourly",
      retentionMode: "count-only",
      keepLast: 5,
      maxAgeDays: 3650,
      includeConfig: true
    });
    assert.equal(response.status, 200);

    backupService.nextRunAt = new Date(Date.now() - 1500).toISOString();

    const deadline = Date.now() + 12000;
    let scheduledRun = null;
    while (Date.now() < deadline) {
      const runsResponse = await request("GET", "/api/superadmin/backups/runs?limit=50");
      assert.equal(runsResponse.status, 200);
      const runs = Array.isArray(runsResponse.json.runs) ? runsResponse.json.runs : [];
      scheduledRun = runs.find((run) => run && run.trigger === "scheduled");
      if (scheduledRun && scheduledRun.status !== "running") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    assert.ok(scheduledRun);
    assert.equal(scheduledRun.status, "completed");
  });
});

test("superadmin backups: oversize upload is rejected", async () => {
  await withServer({ authMode: "optional", backupUploadMaxBytes: 128 }, async ({ request, baseUrl }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    const largeBuffer = Buffer.alloc(4096, 65);
    const form = new FormData();
    form.append("sourceType", "upload");
    form.append("typedConfirm", "RESTORE");
    form.append("archive", new Blob([largeBuffer], { type: "application/zip" }), "too-large.zip");

    const uploadRes = await fetch(`${baseUrl}/api/superadmin/backups/restore`, {
      method: "POST",
      headers: {
        cookie: request.getCookie() || ""
      },
      body: form
    });

    assert.equal(uploadRes.status, 400);
    const uploadJson = await uploadRes.json();
    assert.equal(uploadJson.ok, false);
    assert.match(String(uploadJson.message || ""), /size limit/i);
  });
});


test("audit log access and retention: permissions, events, csv export, and pruning", async () => {
  await withServer({ authMode: "optional" }, async ({ request, auditService }) => {
    let response;

    response = await request("POST", "/api/setup/superadmin", {
      username: "root",
      password: "Aa!23456",
      confirmPassword: "Aa!23456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/auth/me");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.user.canViewAudit, true);

    response = await request("POST", "/api/superadmin/users/", {
      username: "alice",
      password: "Bb!23456",
      role: "admin"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("POST", "/api/superadmin/users/", {
      username: "bob",
      password: "Cc!23456",
      role: "user",
      canViewAudit: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/superadmin/users/");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    const bobRecord = response.json.users.find((entry) => entry.username === "bob");
    assert.ok(bobRecord);
    assert.equal(bobRecord.role, "user");
    assert.equal(bobRecord.canViewAudit, false);

    await request("POST", "/api/auth/logout", {});

    response = await request("POST", "/api/auth/login", {
      username: "alice",
      password: "Bb!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.user.canViewAudit, false);

    response = await request("GET", "/api/admin/audit/events");
    assert.equal(response.status, 403);
    assert.equal(response.json.ok, false);

    response = await request("POST", "/api/superadmin/audit/settings", {
      retentionDays: 30
    });
    assert.equal(response.status, 403);

    await request("POST", "/api/auth/logout", {});

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/superadmin/users/update-role", {
      username: "alice",
      role: "admin",
      canApprove: false,
      canViewAudit: true
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    await request("POST", "/api/auth/logout", {});

    response = await request("POST", "/api/auth/login", {
      username: "alice",
      password: "Bb!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.user.canViewAudit, true);

    response = await request("GET", "/api/admin/audit/settings");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(typeof response.json.settings.retentionDays, "number");

    response = await request("POST", "/api/admin/topic", {
      name: "AuditTopic",
      question: "Audit question?"
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    response = await request("GET", "/api/admin/audit/events?action=kb_topic_create");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(response.json.total >= 1);
    const topicCreateRow = response.json.rows.find((row) => row.action === "kb_topic_create" && row.target === "AuditTopic");
    assert.ok(topicCreateRow);
    assert.equal(topicCreateRow.actor, "alice");

    response = await request("GET", "/api/admin/audit/export.csv?action=kb_topic_create");
    assert.equal(response.status, 200);
    const csvText = String((response.json && response.json.raw) || "");
    assert.match(csvText, /^timestamp_utc,actor,role,action,target,status,reason,ip/m);

    await request("POST", "/api/auth/logout", {});

    response = await request("POST", "/api/auth/login", {
      username: "root",
      password: "Aa!23456",
      rememberMe: false
    });
    assert.equal(response.status, 200);

    const oldTimestamp = new Date(Date.now() - (400 * 24 * 60 * 60 * 1000)).toISOString();
    await auditService.appendEvent({
      timestamp: oldTimestamp,
      actor: "system",
      role: "superadmin",
      action: "kb_topic_create",
      target: "old/audit/event",
      status: "success",
      reason: "old retention test",
      ip: "127.0.0.1"
    });

    response = await request("GET", "/api/admin/audit/events?q=old%2Faudit%2Fevent");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.ok(response.json.total >= 1);

    response = await request("POST", "/api/superadmin/audit/settings", {
      retentionDays: 1
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.settings.retentionDays, 1);

    response = await request("GET", "/api/admin/audit/events?q=old%2Faudit%2Fevent");
    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.total, 0);
  });
});

async function waitForBackupRunComplete(request, runId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await request("GET", `/api/superadmin/backups/runs/${encodeURIComponent(runId)}`);
    if (response.status === 200 && response.json && response.json.ok && response.json.run) {
      const run = response.json.run;
      if (run.status === "completed" || run.status === "failed") {
        return run;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`Timed out waiting for backup run ${runId}`);
}

async function createZipBuffer(entries) {
  const zipFile = new yazl.ZipFile();
  const chunks = [];

  const output = zipFile.outputStream;
  output.on("data", (chunk) => {
    chunks.push(chunk);
  });

  for (const entry of entries) {
    const name = String(entry && entry.name ? entry.name : "").trim();
    if (!name) {
      continue;
    }
    const content = entry && entry.content !== undefined ? String(entry.content) : "";
    zipFile.addBuffer(Buffer.from(content, "utf8"), name);
  }

  const done = new Promise((resolve, reject) => {
    output.on("error", reject);
    output.on("end", () => resolve(Buffer.concat(chunks)));
  });

  zipFile.end();
  return done;
}

async function openSolutionForEdit(request, kbPath) {
  const encoded = encodeURIComponent(String(kbPath || ""));
  const response = await request("GET", "/api/admin/solution?path=" + encoded);
  assert.equal(response.status, 200);
  assert.equal(response.json.ok, true);
  return response;
}

async function createSolutionNode(request, parentPath, answerName, content) {
  let response = await request("POST", "/api/admin/answer", {
    parentPath,
    answerName,
    kind: "solution"
  });
  assert.equal(response.status, 200);

  const fullPath = `${parentPath}/${answerName}`;
  const encodedPath = encodeURIComponent(fullPath);

  response = await request("GET", `/api/admin/solution?path=${encodedPath}`);
  assert.equal(response.status, 200);
  assert.equal(response.json.ok, true);

  response = await request("PUT", `/api/admin/solution?path=${encodedPath}`, {
    content
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.ok, true);
}

let withServerLock = Promise.resolve();

async function withServer({ authMode, backupUploadMaxBytes, backupSchedulerTickSeconds, nodeEnv }, fn) {
  const previousLock = withServerLock;
  let releaseLock;
  withServerLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kbn-int-"));
  const previousEnv = {};

  for (const key of ENV_KEYS) {
    previousEnv[key] = process.env[key];
  }

  process.env.DATA_DIR = path.join(tempRoot, "data");
  process.env.KB_ROOT = path.join(tempRoot, "data", "Knowledgebase");
  process.env.DRAFTS_DIR = path.join(tempRoot, "data", "drafts");
  process.env.SESSIONS_DIR = path.join(tempRoot, "data", "sessions");
  process.env.LOGS_DIR = path.join(tempRoot, "data", "logs");
  process.env.BACKUPS_DIR = path.join(tempRoot, "data", "backups");
  process.env.FLAGS_FILE = path.join(tempRoot, "data", "flags.json");
  process.env.VERSIONS_FILE = path.join(tempRoot, "data", "versions.json");
  process.env.AUTH_MODE = authMode;
  process.env.SESSION_SECRET = "integration-test-secret";

  if (nodeEnv !== undefined && nodeEnv !== null) {
    process.env.NODE_ENV = String(nodeEnv);
  }

  if (backupUploadMaxBytes !== undefined && backupUploadMaxBytes !== null) {
    process.env.BACKUP_UPLOAD_MAX_BYTES = String(backupUploadMaxBytes);
  }

  if (backupSchedulerTickSeconds !== undefined && backupSchedulerTickSeconds !== null) {
    process.env.BACKUP_SCHEDULER_TICK_SECONDS = String(backupSchedulerTickSeconds);
  }

  let server;
  let appShutdown = async () => {};
  try {
    const { app, shutdown, backupService, auditService } = await createApp();
    appShutdown = typeof shutdown === "function" ? shutdown : appShutdown;
    server = app.listen(0);
    const port = await onceListening(server);
    const baseUrl = `http://127.0.0.1:${port}`;
    const request = createRequestClient(baseUrl);

    await fn({ request, tempRoot, baseUrl, backupService, auditService });
  } finally {
    if (server) {
      await closeServer(server);
    }
    await appShutdown();

    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }

    await fs.rm(tempRoot, { recursive: true, force: true });
    if (typeof releaseLock === "function") {
      releaseLock();
    }
  }
}

function createRequestClient(baseUrl) {
  const cookieJar = { value: "" };

  const request = async (method, endpoint, body) => {
    const headers = { "Content-Type": "application/json" };
    if (cookieJar.value) {
      headers.cookie = cookieJar.value;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      cookieJar.value = setCookie.split(";")[0];
    }

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return {
      status: response.status,
      json
    };
  };

  request.getCookie = () => cookieJar.value;
  return request;
}

async function countDraftFiles(tempRoot) {
  const draftsDir = path.join(tempRoot, "data", "drafts");
  const entries = await fs.readdir(draftsDir).catch(() => []);
  return entries.filter((name) => name.endsWith(".json")).length;
}

function onceListening(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      const addr = server.address();
      resolve(addr.port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}
