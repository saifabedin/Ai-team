"use strict";
// Sanitize user-controlled strings before they enter LLM prompts.
// Default 2000 chars; override with SANITIZE_MAX_LEN env var.
const MAX_LEN = parseInt(process.env.SANITIZE_MAX_LEN || "2000", 10);

// Patterns that try to hijack the system prompt.
const INJECTION_RE =
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?|forget\s+(everything|all)|you\s+are\s+now|new\s+role|system\s*:/gi;

function sanitizeStr(s) {
  if (typeof s !== "string") return s;
  return s.replace(INJECTION_RE, "[removed]").slice(0, MAX_LEN);
}

// Recursively sanitize all string leaves of a plain object / array.
function sanitize(obj) {
  if (typeof obj === "string") return sanitizeStr(obj);
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    return out;
  }
  return obj;
}

module.exports = { sanitize, sanitizeStr };
