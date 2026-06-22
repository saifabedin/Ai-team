"use strict";
// Usage: node scripts/set-api-key.cjs <email> [brand_id]
// Generates a random API key, hashes it, stores in ait_users, prints the raw key once.
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../core/db.cjs");
const config = require("../core/config.cjs");

async function main() {
  const email = process.argv[2];
  const brandId = process.argv[3] || config.defaultBrandId;
  if (!email) {
    console.error("Usage: node scripts/set-api-key.cjs <email> [brand_id]");
    process.exit(1);
  }

  const rawKey = crypto.randomBytes(32).toString("hex"); // 64-char hex
  const hash = await bcrypt.hash(rawKey, 10);

  const result = await db.query(
    `update ait_users set api_key_hash=$3, password_changed_at=now()
     where brand_id=$1 and email=$2`,
    [brandId, email, hash]
  );

  if (result.rowCount === 0) {
    console.error(`No user found: brand=${brandId} email=${email}`);
    process.exit(1);
  }

  console.log("\n✓ API key set for", email);
  console.log("  API key (save this — shown once):", rawKey);
  console.log("\nGet a token:");
  console.log(`  curl -X POST http://localhost:4100/auth/token \\`);
  console.log(`    -H 'Content-Type: application/json' \\`);
  console.log(`    -d '{"email":"${email}","api_key":"${rawKey}","brand_id":"${brandId}"}'`);

  await db.pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
