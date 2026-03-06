function attachAuthContext(config) {
  return (req, _res, next) => {
    const sessionUser = req.session && req.session.user ? req.session.user : null;
    if (sessionUser) {
      req.auth = {
        isAuthenticated: true,
        user: sessionUser,
        role: sessionUser.role,
        canApprove: Boolean(sessionUser.canApprove),
        canViewAudit: Boolean(sessionUser.canViewAudit)
      };
    } else if (config.auth.mode === "optional") {
      req.auth = {
        isAuthenticated: false,
        user: null,
        role: "user",
        canApprove: false,
        canViewAudit: false
      };
    } else {
      req.auth = {
        isAuthenticated: false,
        user: null,
        role: null,
        canApprove: false,
        canViewAudit: false
      };
    }
    next();
  };
}

function requireAuth() {
  return (req, res, next) => {
    if (req.auth && req.auth.isAuthenticated) {
      return next();
    }
    return res.status(401).json({ ok: false, message: "Authentication required" });
  };
}

module.exports = {
  attachAuthContext,
  requireAuth
};