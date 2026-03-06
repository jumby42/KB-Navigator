const sanitizeHtml = require("sanitize-html");

const SANITIZE_OPTIONS = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "span",
    "div"
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "style"],
    img: ["src", "alt", "title", "width", "height", "style"],
    p: ["style"],
    span: ["style"],
    div: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    h5: ["style"],
    h6: ["style"],
    ul: ["style"],
    ol: ["style"],
    li: ["style"]
  },
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"]
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/, /^[a-zA-Z]+$/],
      "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/, /^[a-zA-Z]+$/],
      "font-size": [/^\d+(px|em|rem|%)$/],
      "text-align": [/^(left|center|right|justify)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(none|underline)$/],
      width: [/^\d+(px|%)$/],
      height: [/^\d+(px|%)$/],
      "max-width": [/^\d+(px|%)$/]
    }
  },
  parser: {
    lowerCaseAttributeNames: true
  }
};

function sanitizeSolutionHtml(html) {
  return sanitizeHtml(String(html || ""), SANITIZE_OPTIONS);
}

module.exports = {
  sanitizeSolutionHtml
};
