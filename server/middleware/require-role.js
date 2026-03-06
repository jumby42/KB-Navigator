const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const role = req.auth ? req.auth.role : null;
    if (!role || !allowed.includes(role)) {
      if (MUTATION_METHODS.has(String(req.method || "").toUpperCase())) {
        const logger = req.app && req.app.locals ? req.app.locals.logger : null;
        if (logger && typeof logger.warn === "function") {
          logger.warn("Permission denied", {
            event: "permission_denied",
            method: String(req.method || "").toUpperCase(),
            path: req.originalUrl || req.url || "",
            role: role || "anonymous",
            username: req.auth && req.auth.user ? req.auth.user.username : "",
            requiredRoles: allowed,
            ip: req.ip || "unknown"
          });
        }
      }
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    return next();
  };
}

module.exports = {
  requireRole
};