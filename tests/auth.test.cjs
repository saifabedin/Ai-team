"use strict";
// Unit tests for JWT middleware behaviour (no DB/Redis needed).
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");

// Override env before config loads.
process.env.JWT_SECRET = "a".repeat(64);
process.env.DATABASE_URL = "postgres://test:test@localhost/test"; // not used in these tests
process.env.REDIS_URL = "redis://127.0.0.1:6379";

const jwt = require("jsonwebtoken");

describe("JWT token shape", () => {
  const secret = "a".repeat(64);
  const payload = { email: "owner@test.com", role: "owner", brandId: "fixmyleads", sub: "1" };

  it("signs and verifies a 15-min token", () => {
    const token = jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "15m" });
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    assert.equal(decoded.email, payload.email);
    assert.equal(decoded.role, payload.role);
    assert.equal(decoded.brandId, payload.brandId);
    assert.ok(decoded.exp - decoded.iat <= 900 + 2); // max 900s = 15min
  });

  it("rejects a tampered token", () => {
    const token = jwt.sign(payload, secret, { algorithm: "HS256" });
    const tampered = token.slice(0, -4) + "XXXX";
    assert.throws(
      () => jwt.verify(tampered, secret, { algorithms: ["HS256"] }),
      /invalid signature/i
    );
  });

  it("rejects a token signed with wrong secret", () => {
    const bad = jwt.sign(payload, "wrong".repeat(13), { algorithm: "HS256" });
    assert.throws(
      () => jwt.verify(bad, secret, { algorithms: ["HS256"] }),
      /invalid signature/i
    );
  });
});
