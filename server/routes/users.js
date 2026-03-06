const express = require("express");
const { requireAuth } = require("../middleware/require-auth");
const { requireRole } = require("../middleware/require-role");

function createUsersRouter({ userService, sessionService, draftService, lockService, approvalService }) {
  const router = express.Router();
  router.use(requireAuth(), requireRole("superadmin"));

  router.get("/", async (_req, res, next) => {
    try {
      const users = await userService.listUsers();
      return res.json({ ok: true, users });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const { username, password, role, canApprove, canViewAudit } = req.body || {};
      const actor = req.session && req.session.user ? req.session.user.username : "";
      const result = await userService.createUser({
        username,
        password,
        role,
        canApprove,
        canViewAudit,
        actor
      });
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/update-role", async (req, res, next) => {
    try {
      const { username, role, canApprove, canViewAudit } = req.body || {};
      const actor = req.session.user.username;
      const result = await userService.updateRole(username, role, actor, canApprove, canViewAudit);
      if (result.ok) {
        await sessionService.invalidateUserSessions(username);
      }
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    try {
      const { username } = req.body || {};
      const actor = req.session && req.session.user ? req.session.user.username : "";
      const result = await userService.resetPassword(username, actor);
      if (!result.ok) {
        return res.status(400).json(result);
      }

      await sessionService.invalidateUserSessions(username);
      return res.json({
        ok: true,
        username: result.username,
        tempPassword: result.tempPassword
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/delete", async (req, res, next) => {
    try {
      const { username, confirm } = req.body || {};
      if (!confirm) {
        return res.status(400).json({ ok: false, message: "Delete requires confirm=true." });
      }

      const actor = req.session.user.username;
      const deleteResult = await userService.deleteUser(username, actor);
      if (!deleteResult.ok) {
        return res.status(400).json(deleteResult);
      }

      const deletedDrafts = await draftService.deleteDraftsByOwner(username);
      const releasedLocks = await lockService.releaseLocksByOwner(username);
      const deletedPendingSubmissions = approvalService
        ? (await approvalService.deletePendingSubmissionsByUser(username)).deleted
        : 0;
      const invalidatedSessions = await sessionService.invalidateUserSessions(username);

      return res.json({
        ok: true,
        username,
        deletedDrafts,
        releasedLocks,
        deletedPendingSubmissions,
        invalidatedSessions
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createUsersRouter
};