const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function ensureJsonFile(filePath, defaultValue) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
  } catch {
    await ensureDir(path.dirname(filePath));
    const payload = `${JSON.stringify(defaultValue, null, 2)}\n`;
    await writeFileAtomic(filePath, payload, "utf8");
  }
}

async function ensureFile(filePath, defaultContent = "") {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
  } catch {
    await ensureDir(path.dirname(filePath));
    await writeFileAtomic(filePath, defaultContent, "utf8");
  }
}

async function writeFileAtomic(filePath, content, encoding = "utf8") {
  const dir = path.dirname(filePath);
  const tempName = `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const tempPath = path.join(dir, tempName);

  await ensureDir(dir);
  try {
    await fsp.writeFile(tempPath, content, encoding);
    await fsp.rename(tempPath, filePath);
  } catch (error) {
    await fsp.unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function assertReadWrite(dirPath) {
  await fsp.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  ensureDir,
  ensureJsonFile,
  ensureFile,
  writeFileAtomic,
  assertReadWrite,
  nowIso
};
