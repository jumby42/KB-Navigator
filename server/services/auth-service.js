const { normalizeUsername } = require("./user-service");

class AuthService {
  constructor(config, logger, userService) {
    this.config = config;
    this.logger = logger;
    this.userService = userService;
  }

  async login({ username, password, ip }) {
    const user = await this.userService.verifyCredentials(username, password);
    const attemptedUsername = String(username || "").trim();
    const normalized = normalizeUsername(username);

    if (!user) {
      this.logger.warn("Login failed", {
        event: "login_failed",
        username: attemptedUsername,
        normalizedUsername: normalized,
        ip: ip || "unknown"
      });
      return { ok: false, message: "Invalid credentials" };
    }

    await this.userService.updateLastLogin(user.username);
    this.logger.info("Login success", {
      event: "login_success",
      username: user.username,
      role: user.role,
      ip: ip || "unknown"
    });

    return {
      ok: true,
      user: {
        username: user.username,
        role: user.role,
        canApprove: Boolean(user.canApprove),
        canViewAudit: Boolean(user.canViewAudit)
      }
    };
  }
}

module.exports = {
  AuthService
};