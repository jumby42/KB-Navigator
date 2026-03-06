function requireAuditAccess() {
  return (req, res, next) => {
    const role = req.auth && req.auth.role ? String(req.auth.role) : "";
    const canViewAudit = Boolean(req.auth && req.auth.canViewAudit);

    if ((role === "admin" || role === "superadmin") && canViewAudit) {
      return next();
    }

    return res.status(403).json({ ok: false, message: "Audit access permission required." });
  };
}

module.exports = {
  requireAuditAccess
};
