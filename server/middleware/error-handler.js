function notFoundHandler(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, message: "Not found" });
  }
  return res.status(404).send("Not found");
}

function errorHandler(logger) {
  return (err, req, res, _next) => {
    logger.error("Unhandled server error", {
      event: "server_error",
      route: req.originalUrl,
      method: req.method,
      error: err.message
    });

    if (req.path.startsWith("/api/")) {
      return res.status(500).json({ ok: false, message: "Internal server error" });
    }
    return res.status(500).send("Internal server error");
  };
}

module.exports = {
  notFoundHandler,
  errorHandler
};
