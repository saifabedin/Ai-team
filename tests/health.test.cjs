const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Environment', () => {
  it('should have Node.js >= 18', () => {
    const version = process.versions.node.split('.').map(Number);
    assert.ok(version[0] >= 18, 'Node.js >= 18 required');
  });
});
