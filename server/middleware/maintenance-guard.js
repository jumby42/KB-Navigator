function createWriteMaintenanceGuard(backupService) {
  return (req, res, next) => {
    if (!req || ["GET", "HEAD", "OPTIONS"].includes(String(req.method || "").toUpperCase())) {
      return next();
    }

    if (!backupService || typeof backupService.isWriteMaintenanceActive !== "function") {
      return next();
    }

    if (!backupService.isWriteMaintenanceActive()) {
      return next();
    }

    const status = typeof backupService.getMaintenanceStatus === "function"
      ? backupService.getMaintenanceStatus()
      : { active: true };

    return res.status(503).json({
      ok: false,
      message: "Restore is in progress. Write operations are temporarily unavailable.",
      maintenance: status
    });
  };
}

module.exports = {
  createWriteMaintenanceGuard
};
