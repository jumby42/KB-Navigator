const rateLimit = require("express-rate-limit");

const DEFAULT_LIMITS = Object.freeze({
  read: {
    windowSeconds: 60,
    maxRequests: 240
  },
  search: {
    windowSeconds: 60,
    maxRequests: 90
  },
  adminWrite: {
    windowSeconds: 60,
    maxRequests: 120
  }
});

function createLoginRateLimiter(config) {
  return rateLimit({
    windowMs: config.auth.loginRateLimit.windowMinutes * 60 * 1000,
    max: config.auth.loginRateLimit.maxAttempts,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      message: "Too many login attempts. Please try again later."
    }
  });
}

function createReadRateLimiter(config) {
  const limits = readApiLimits(config);
  return createApiLimiter({
    limits,
    message: "Rate limit exceeded for read requests. Please retry shortly.",
    keyByUser: true
  });
}

function createSearchRateLimiter(config) {
  const limits = readSearchLimits(config);
  return createApiLimiter({
    limits,
    message: "Rate limit exceeded for search. Please retry shortly.",
    keyByUser: true
  });
}

function createAdminWriteRateLimiter(config) {
  const limits = readAdminWriteLimits(config);
  return createApiLimiter({
    limits,
    message: "Rate limit exceeded for admin write operations. Please retry shortly.",
    keyByUser: true,
    skip: (req) => req.method === "GET"
  });
}

function createApiLimiter({ limits, message, keyByUser, skip }) {
  const windowMs = normalizePositiveInt(limits.windowSeconds, 60) * 1000;
  const max = normalizePositiveInt(limits.maxRequests, 120);

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    keyGenerator: keyByUser ? keyByUserOrIp : undefined,
    message: {
      ok: false,
      message
    }
  });
}

function readApiLimits(config) {
  const source = config && config.rateLimit && config.rateLimit.read ? config.rateLimit.read : {};
  return {
    windowSeconds: normalizePositiveInt(source.windowSeconds, DEFAULT_LIMITS.read.windowSeconds),
    maxRequests: normalizePositiveInt(source.maxRequests, DEFAULT_LIMITS.read.maxRequests)
  };
}

function readSearchLimits(config) {
  const source = config && config.rateLimit && config.rateLimit.search ? config.rateLimit.search : {};
  return {
    windowSeconds: normalizePositiveInt(source.windowSeconds, DEFAULT_LIMITS.search.windowSeconds),
    maxRequests: normalizePositiveInt(source.maxRequests, DEFAULT_LIMITS.search.maxRequests)
  };
}

function readAdminWriteLimits(config) {
  const source = config && config.rateLimit && config.rateLimit.adminWrite ? config.rateLimit.adminWrite : {};
  return {
    windowSeconds: normalizePositiveInt(source.windowSeconds, DEFAULT_LIMITS.adminWrite.windowSeconds),
    maxRequests: normalizePositiveInt(source.maxRequests, DEFAULT_LIMITS.adminWrite.maxRequests)
  };
}

function keyByUserOrIp(req) {
  const username = req && req.auth && req.auth.isAuthenticated && req.auth.user && req.auth.user.username
    ? String(req.auth.user.username).trim().toLowerCase()
    : "";
  if (username) {
    return `user:${username}`;
  }
  return req.ip;
}

function normalizePositiveInt(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return Math.floor(numeric);
}

module.exports = {
  createLoginRateLimiter,
  createReadRateLimiter,
  createSearchRateLimiter,
  createAdminWriteRateLimiter
};
