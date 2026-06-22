"use strict";

function ts() {
  return new Date().toISOString();
}

function fmt(level, scope, msg, extra) {
  const base = `${ts()} [${level}] [${scope}] ${msg}`;
  if (extra === undefined) return base;
  try {
    return `${base} ${typeof extra === "string" ? extra : JSON.stringify(extra)}`;
  } catch {
    return base;
  }
}

function make(scope) {
  return {
    info: (m, e) => console.log(fmt("INFO", scope, m, e)),
    warn: (m, e) => console.warn(fmt("WARN", scope, m, e)),
    error: (m, e) => console.error(fmt("ERROR", scope, m, e)),
    debug: (m, e) => {
      if (process.env.DEBUG) console.log(fmt("DEBUG", scope, m, e));
    },
  };
}

module.exports = { logger: make, make };
