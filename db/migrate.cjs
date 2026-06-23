"use strict";
// Runs db/schema.sql against the live Neon database. Idempotent.
const fs = require("fs");
const path = require("path");
const db = require("../core/db.cjs");
const log = require("../core/logger.cjs").make("migrate");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  log.info("applying schema.sql ...");
  await db.query(sql);
  const { rows: aitRows } = await db.query(
    `select table_name from information_schema.tables
     where table_schema='public' and table_name like 'ait_%' order by 1`
  );
  log.info(`done. ait_ tables present: ${aitRows.length}`);
  aitRows.forEach((r) => console.log("  -", r.table_name));

  const { rows: fmlhRows } = await db.query(
    `select table_name from information_schema.tables
     where table_schema='public' and table_name like 'fmlh_%' order by 1`
  );
  log.info(`fmlh_ tables present: ${fmlhRows.length}`);
  fmlhRows.forEach((r) => console.log("  -", r.table_name));
  await db.pool.end();
}

main().catch((e) => {
  log.error("migration failed", e.message);
  process.exit(1);
});
