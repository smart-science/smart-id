/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('node:assert/strict');

if (process.env.CI) {
    assert.equal(process.versions.bun, undefined, 'smoke tests must run under Node in CI to test dist/');
}

const { format, generate, generateFormatted, isFormattedSID, isSID, parse, verify } = require('@smart-science/sid');

const id = generate();
assert.equal(id.length, 16);
assert.equal(verify('0123456789ABCDE7'), true);
assert.equal(verify(null), false);
assert.equal(isSID(id), true);
assert.equal(isFormattedSID(generateFormatted()), true);
assert.deepEqual(format('0123456789ABCDE7'), { ok: true, data: '0123-4567-89AB-CDE7' });
assert.equal(parse('0123456789ABCDEN').code, 'CHECKSUM_MISMATCH');

assert.deepEqual(Object.keys(require('@smart-science/sid')).sort(), [
    'format',
    'generate',
    'generateFormatted',
    'isFormattedSID',
    'isSID',
    'parse',
    'verify',
]);

console.log('CJS smoke test passed.');
