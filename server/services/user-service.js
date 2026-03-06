const crypto = require("crypto");
const fs = require("fs/promises");
const bcrypt = require("bcrypt");
const { nowIso, writeFileAtomic } = require("../utils/fs-utils");
const { validatePasswordPolicy } = require("../utils/validators");

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

class UserService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.usersFile = config.paths.usersFileAbsolute;
    this.usersCacheTtlMs = 1000;
    this.usersCacheExpiresAt = 0;
    this.usersCache = null;
  }

  async listUsers() {
    const users = await this.#readUsers();
    return users
      .map((entry) => ({
        username: entry.username,
        role: entry.role,
        canApprove: Boolean(entry.canApprove),
        canViewAudit: Boolean(entry.canViewAudit),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastLoginAt: entry.lastLoginAt || null
      }))
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }));
  }

  async hasSuperadmin() {
    const users = await this.#readUsers();
    return users.some((user) => user.role === "superadmin");
  }

  async countSuperadmins() {
    const users = await this.#readUsers();
    return users.filter((user) => user.role === "superadmin").length;
  }

  async getByUsername(username) {
    const users = await this.#readUsers();
    const normalized = normalizeUsername(username);
    return users.find((entry) => entry.normalizedUsername === normalized) || null;
  }

  async verifyCredentials(username, password) {
    const user = await this.getByUsername(username);
    if (!user) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return {
      username: user.username,
      role: user.role,
      canApprove: Boolean(user.canApprove),
      canViewAudit: Boolean(user.canViewAudit),
      normalizedUsername: user.normalizedUsername
    };
  }

  async createUser({ username, password, role, canApprove, canViewAudit, actor }) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return { ok: false, message: "Username is required." };
    }

    if (!["superadmin", "admin", "user"].includes(role)) {
      return { ok: false, message: "Invalid role." };
    }

    const passwordCheck = validatePasswordPolicy(this.config.passwordPolicy, password);
    if (!passwordCheck.ok) {
      return passwordCheck;
    }

    const users = await this.#readUsers();
    const existing = users.find((entry) => entry.normalizedUsername === normalized);
    if (existing) {
      return { ok: false, message: "Username already exists." };
    }

    const now = nowIso();
    const passwordHash = await bcrypt.hash(password, this.config.security.bcryptRounds);
    const newUser = {
      username: String(username).trim(),
      normalizedUsername: normalized,
      passwordHash,
      role,
      canApprove: normalizeCanApproveForRole(role, canApprove),
      canViewAudit: normalizeCanViewAuditForRole(role, canViewAudit),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    };

    users.push(newUser);
    await this.#writeUsers(users);

    this.logger.info("User created", {
      event: "user_create",
      actor: normalizeUsername(actor) || "system",
      username: newUser.username,
      role,
      canApprove: newUser.canApprove,
      canViewAudit: newUser.canViewAudit
    });

    return { ok: true };
  }

  async updateRole(username, nextRole, actingUsername, canApproveInput, canViewAuditInput) {
    const normalized = normalizeUsername(username);
    const normalizedActor = normalizeUsername(actingUsername);
    if (!["superadmin", "admin", "user"].includes(nextRole)) {
      return { ok: false, message: "Invalid role." };
    }

    const users = await this.#readUsers();
    const idx = users.findIndex((entry) => entry.normalizedUsername === normalized);
    if (idx < 0) {
      return { ok: false, message: "User not found." };
    }

    const target = users[idx];
    const currentRole = target.role;
    const currentCanApprove = Boolean(target.canApprove);
    const currentCanViewAudit = Boolean(target.canViewAudit);
    const roleChanged = currentRole !== nextRole;

    let nextCanApprove;
    if (nextRole === "user") {
      nextCanApprove = false;
    } else if (typeof canApproveInput === "boolean") {
      nextCanApprove = canApproveInput;
    } else if (!roleChanged) {
      nextCanApprove = currentCanApprove;
    } else if (nextRole === "superadmin") {
      nextCanApprove = true;
    } else {
      nextCanApprove = false;
    }

    let nextCanViewAudit;
    if (nextRole === "user") {
      nextCanViewAudit = false;
    } else if (typeof canViewAuditInput === "boolean") {
      nextCanViewAudit = canViewAuditInput;
    } else if (!roleChanged) {
      nextCanViewAudit = currentCanViewAudit;
    } else if (nextRole === "superadmin") {
      nextCanViewAudit = true;
    } else {
      nextCanViewAudit = false;
    }

    if (!roleChanged && currentCanApprove === nextCanApprove && currentCanViewAudit === nextCanViewAudit) {
      return { ok: true };
    }

    if (normalized === normalizedActor && currentRole === "superadmin" && nextRole !== "superadmin") {
      return { ok: false, message: "Superadmin self-demotion is blocked in MVP." };
    }

    if (currentRole === "superadmin" && nextRole !== "superadmin") {
      const remaining = users.filter((u) => u.role === "superadmin" && u.normalizedUsername !== normalized).length;
      if (remaining < 1) {
        return { ok: false, message: "Cannot remove role from the last remaining superadmin." };
      }
    }

    users[idx].role = nextRole;
    users[idx].canApprove = nextCanApprove;
    users[idx].canViewAudit = nextCanViewAudit;
    users[idx].updatedAt = nowIso();
    await this.#writeUsers(users);

    this.logger.info("User role updated", {
      event: "user_role_update",
      actor: normalizedActor || "system",
      username: users[idx].username,
      role: nextRole,
      canApprove: nextCanApprove,
      canViewAudit: nextCanViewAudit
    });

    return { ok: true };
  }

  async updateLastLogin(username) {
    const normalized = normalizeUsername(username);
    const users = await this.#readUsers();
    const idx = users.findIndex((entry) => entry.normalizedUsername === normalized);
    if (idx < 0) {
      return;
    }

    users[idx].lastLoginAt = nowIso();
    users[idx].updatedAt = nowIso();
    await this.#writeUsers(users);
  }

  async changePassword(username, oldPassword, newPassword) {
    const normalized = normalizeUsername(username);
    const users = await this.#readUsers();
    const idx = users.findIndex((entry) => entry.normalizedUsername === normalized);
    if (idx < 0) {
      return { ok: false, message: "User not found." };
    }

    const validOld = await bcrypt.compare(oldPassword, users[idx].passwordHash);
    if (!validOld) {
      return { ok: false, message: "Current password is incorrect." };
    }

    const policyResult = validatePasswordPolicy(this.config.passwordPolicy, newPassword);
    if (!policyResult.ok) {
      return policyResult;
    }

    users[idx].passwordHash = await bcrypt.hash(newPassword, this.config.security.bcryptRounds);
    users[idx].updatedAt = nowIso();
    await this.#writeUsers(users);

    this.logger.info("Password changed", {
      event: "password_change",
      username: users[idx].username
    });

    return { ok: true };
  }

  async resetPassword(username, actorInput) {
    const normalized = normalizeUsername(username);
    const users = await this.#readUsers();
    const idx = users.findIndex((entry) => entry.normalizedUsername === normalized);
    if (idx < 0) {
      return { ok: false, message: "User not found." };
    }

    const tempPassword = this.#generateTemporaryPassword();
    users[idx].passwordHash = await bcrypt.hash(tempPassword, this.config.security.bcryptRounds);
    users[idx].updatedAt = nowIso();
    await this.#writeUsers(users);

    this.logger.info("Password reset", {
      event: "password_reset",
      actor: normalizeUsername(actorInput) || "system",
      username: users[idx].username
    });

    return {
      ok: true,
      username: users[idx].username,
      tempPassword
    };
  }

  async deleteUser(username, actingUsername) {
    const normalized = normalizeUsername(username);
    const normalizedActor = normalizeUsername(actingUsername);

    const users = await this.#readUsers();
    const idx = users.findIndex((entry) => entry.normalizedUsername === normalized);
    if (idx < 0) {
      return { ok: false, message: "User not found." };
    }

    const target = users[idx];
    if (normalized === normalizedActor && !this.config.users.allowSelfDelete) {
      return { ok: false, message: "Superadmin self-delete is blocked in MVP." };
    }

    if (target.role === "superadmin") {
      const remaining = users.filter((u) => u.role === "superadmin" && u.normalizedUsername !== normalized).length;
      if (remaining < 1) {
        return { ok: false, message: "Cannot delete the last remaining superadmin." };
      }
    }

    users.splice(idx, 1);
    await this.#writeUsers(users);

    this.logger.info("User deleted", {
      event: "user_delete",
      actor: normalizedActor || "system",
      username: target.username,
      role: target.role
    });

    return { ok: true, username: target.username };
  }

  async #readUsers() {
    const now = Date.now();
    if (this.usersCache && now < this.usersCacheExpiresAt) {
      return cloneUsers(this.usersCache);
    }

    const raw = await fs.readFile(this.usersFile, "utf8");
    let normalizedUsers = [];
    if (raw.trim()) {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        throw new Error(`Invalid users.json format: ${error.message}`);
      }

      if (!Array.isArray(parsed)) {
        throw new Error("Invalid users.json format: expected an array");
      }

      normalizedUsers = parsed.map((entry) => {
        const role = String(entry.role || "user").trim().toLowerCase();
        return {
          ...entry,
          username: String(entry.username || "").trim(),
          normalizedUsername: entry.normalizedUsername || normalizeUsername(entry.username),
          canApprove: normalizeCanApproveForRole(role, entry.canApprove),
          canViewAudit: normalizeCanViewAuditForRole(role, entry.canViewAudit)
        };
      });
    }

    this.usersCache = cloneUsers(normalizedUsers);
    this.usersCacheExpiresAt = now + this.usersCacheTtlMs;
    return cloneUsers(normalizedUsers);
  }

  async #writeUsers(users) {
    const payload = `${JSON.stringify(users, null, 2)}\n`;
    await writeFileAtomic(this.usersFile, payload, "utf8");
    this.usersCache = cloneUsers(users);
    this.usersCacheExpiresAt = Date.now() + this.usersCacheTtlMs;
  }

  #generateTemporaryPassword() {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const number = "0123456789";
    const symbol = this.config.passwordPolicy.allowedSymbols;

    const allPools = [lower, upper, number, symbol];
    const requiredPools = shuffle([0, 1, 2, 3]).slice(0, this.config.passwordPolicy.requireCategories);

    const chars = [];
    for (const idx of requiredPools) {
      chars.push(randomFrom(allPools[idx]));
    }

    while (chars.length < Math.max(this.config.passwordPolicy.minLength, 12)) {
      const pool = allPools[randomInt(0, allPools.length - 1)];
      chars.push(randomFrom(pool));
    }

    const candidate = shuffle(chars).join("");
    const policyCheck = validatePasswordPolicy(this.config.passwordPolicy, candidate);
    if (policyCheck.ok) {
      return candidate;
    }

    return this.#generateTemporaryPassword();
  }
}

function normalizeCanApproveForRole(roleInput, canApproveInput) {
  const role = String(roleInput || "user").trim().toLowerCase();
  if (role === "user") {
    return false;
  }

  if (typeof canApproveInput === "boolean") {
    return canApproveInput;
  }

  return role === "superadmin";
}

function normalizeCanViewAuditForRole(roleInput, canViewAuditInput) {
  const role = String(roleInput || "user").trim().toLowerCase();
  if (role === "user") {
    return false;
  }

  if (typeof canViewAuditInput === "boolean") {
    return canViewAuditInput;
  }

  return role === "superadmin";
}

function cloneUsers(users) {
  return (Array.isArray(users) ? users : []).map((entry) => ({ ...entry }));
}

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function randomFrom(chars) {
  return chars[randomInt(0, chars.length - 1)];
}

function shuffle(input) {
  const arr = Array.isArray(input) ? [...input] : String(input).split("");
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

module.exports = {
  UserService,
  normalizeUsername
};