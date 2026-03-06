const express = require("express");

function createSetupRouter({ userService }) {
  const router = express.Router();

  router.get("/status", async (_req, res, next) => {
    try {
      const hasSuperadmin = await userService.hasSuperadmin();
      res.json({
        ok: true,
        needsSetup: !hasSuperadmin
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/superadmin", async (req, res, next) => {
    try {
      const hasSuperadmin = await userService.hasSuperadmin();
      if (hasSuperadmin) {
        return res.status(409).json({
          ok: false,
          message: "A superadmin already exists."
        });
      }

      const { username, password, confirmPassword } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({
          ok: false,
          message: "Username and password are required."
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          ok: false,
          message: "Password confirmation does not match."
        });
      }

      const created = await userService.createUser({
        username,
        password,
        role: "superadmin"
      });

      if (!created.ok) {
        return res.status(400).json(created);
      }

      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createSetupRouter
};
