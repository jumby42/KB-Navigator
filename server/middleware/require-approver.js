function requireApprover() {
  return (req, res, next) => {
    const canApprove = Boolean(req.auth && req.auth.user && req.auth.user.canApprove);
    if (!canApprove) {
      return res.status(403).json({ ok: false, message: "Approver permission required." });
    }
    return next();
  };
}

module.exports = {
  requireApprover
};
