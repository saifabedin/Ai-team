const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/ai_team_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('Core Modules', () => {
  it('should load config', () => {
    const config = require('../core/config.cjs');
    assert.ok(config);
  });

  it('should load sanitize', () => {
    const sanitize = require('../core/sanitize.cjs');
    assert.ok(sanitize);
    assert.ok(typeof sanitize.sanitize === 'function');
  });

  it('should load logger', () => {
    const logger = require('../core/logger.cjs');
    assert.ok(logger);
    assert.ok(typeof logger.info === 'function');
  });

  it('should load db', () => {
    const db = require('../core/db.cjs');
    assert.ok(db);
    assert.ok(typeof db.query === 'function');
  });
});

describe('Gateway Modules', () => {
  it('should load auth module without errors', () => {
    assert.doesNotThrow(() => {
      require('../gateway/auth.cjs');
    });
  });

  it('should load middleware without errors', () => {
    assert.doesNotThrow(() => {
      require('../gateway/middleware.cjs');
    });
  });
});
