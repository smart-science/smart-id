/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('node:assert/strict');

if (process.env.CI) {
    assert.equal(process.versions.bun, undefined, 'smoke tests must run under Node in CI to test dist/');
}

const { verify, generate } = require('@smart-science/sid');

const id = generate();
assert.equal(id.length, 16);
assert.equal(verify('0123456789ABCDE7'), true);
assert.equal(verify(null), false);

console.log('CJS smoke test passed.');
