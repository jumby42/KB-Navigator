const express = require("express");
const { requireAuth } = require("../middleware/require-auth");

function createUserSelfRouter({ userService }) {
  const router = express.Router();
  router.use(requireAuth());

  router.post("/change-password", async (req, res, next) => {
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
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createUserSelfRouter
};
