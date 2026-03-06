const express = require("express");
const { createLoginRateLimiter } = require("../middleware/rate-limit");
const { requireAuth } = require("../middleware/require-auth");

function createAuthRouter({ config, authService, userService, logger, sessionService }) {
  const router = express.Router();
  const loginLimiter = createLoginRateLimiter(config);

  router.post("/login", loginLimiter, async (req, res, next) => {
    try {
      const hasSuperadmin = await userService.hasSuperadmin();
      if (!hasSuperadmin) {
        return res.status(409).json({
          ok: false,
          needsSetup: true,
          message: "Superadmin setup is required before login.",
          authMode: config.auth.mode
        });
      }

      const { username, password, rememberMe } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({
          ok: false,
          message: "Username and password are required.",
          authMode: config.auth.mode
        });
      }

      const result = await authService.login({ username, password, ip: req.ip });
      if (!result.ok) {
        return res.status(401).json({ ...result, authMode: config.auth.mode });
      }

      req.session.user = result.user;
      req.session.createdAt = new Date().toISOString();
      if (sessionService && typeof sessionService.trackSession === "function") {
        sessionService.trackSession(result.user.username, req.sessionID);
      }
      if (rememberMe) {
        req.session.cookie.maxAge = config.auth.rememberMeDays * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.expires = false;
      }

      return res.json({ ...result, authMode: config.auth.mode });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/logout", (req, res, next) => {
    const username = req.session && req.session.user ? req.session.user.username : null;
    const sessionId = req.sessionID;
    if (sessionService && typeof sessionService.untrackSession === "function") {
      sessionService.untrackSession(username, sessionId);
    }

    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      if (username) {
        logger.info("Logout success", {
          event: "logout_success",
          username,
          ip: req.ip || "unknown"
        });
      }
      return res.json({ ok: true, authMode: config.auth.mode });
    });
  });

  router.get("/me", async (req, res, next) => {
    try {
      if (req.session && req.session.user) {
        return res.json({ ok: true, user: req.session.user, authMode: config.auth.mode });
      }
      return res.json({ ok: false, authMode: config.auth.mode });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/change-password", requireAuth(), async (req, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body || {};
      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          ok: false,
          message: "Current and new password are required."
        });
      }

      const username = req.session.user.username;
      const result = await userService.changePassword(username, oldPassword, newPassword);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAuthRouter
};
