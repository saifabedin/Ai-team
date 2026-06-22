"use strict";
// Neon Postgres pool — reuses the live ECM DATABASE_URL.
const { Pool } = require("pg");
const config = require("./config.cjs");
const log = require("./logger.cjs").make("db");

let pool = null;

if (config.databaseUrl) {
  // DEFAULT: cert validation enforced. Set DB_SSL_REJECT_UNAUTHORIZED=false to disable (required for Neon.tech).
  const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";
  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: sslRejectUnauthorized },
    max: 10,
    idleTimeoutMillis: 30000,
  });
  pool.on("error", (e) => log.error("idle client error", e.message));
} else {
  log.warn("DATABASE_URL missing — DB disabled");
}

async function query(text, params) {
  if (!pool) throw new Error("DB not configured (DATABASE_URL missing)");
  const start = Date.now();
  const res = await pool.query(text, params);
  log.debug("query", { ms: Date.now() - start, rows: res.rowCount });
  return res;
}

// Convenience: returns first row or null.
async function one(text, params) {
  const r = await query(text, params);
  return r.rows[0] || null;
}

async function many(text, params) {
  const r = await query(text, params);
  return r.rows;
}

async function tx(fn) {
  if (!pool) throw new Error("DB not configured (DATABASE_URL missing)");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, one, many, tx };
