function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function validatePasswordPolicy(policy, password) {
  if (typeof password !== "string") {
    return { ok: false, message: "Password is required." };
  }

  if (password.length < policy.minLength) {
    return {
      ok: false,
      message: `Password must be at least ${policy.minLength} characters.`
    };
  }

  const allowedSymbolSet = new Set(String(policy.allowedSymbols || "").split(""));
  const hasUnsupportedSymbol = [...password].some(
    (ch) => !/[A-Za-z0-9]/.test(ch) && !allowedSymbolSet.has(ch)
  );
  if (hasUnsupportedSymbol) {
    return { ok: false, message: "Password contains an unsupported symbol." };
  }

  const categories = {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: [...password].some((ch) => allowedSymbolSet.has(ch))
  };

  const matched = Object.values(categories).filter(Boolean).length;
  if (matched < policy.requireCategories) {
    return {
      ok: false,
      message: `Password must include at least ${policy.requireCategories} of 4 categories: lowercase, uppercase, number, symbol.`
    };
  }

  return { ok: true };
}

module.exports = {
  parseBoolean,
  parseInteger,
  isPositiveInt,
  validatePasswordPolicy
};
