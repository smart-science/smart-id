/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

const assert = require('node:assert/strict');

if (process.env.CI) {
    assert.equal(process.versions.bun, undefined, 'smoke tests must run under Node in CI to test dist/');
}

const {
    CROCKFORD_ALPHABET,
    format,
    fromBytes,
    generate,
    generateFormatted,
    isFormattedSID,
    isSID,
    parse,
    verify,
} = require('@smart-science/sid');

const id = generate();
assert.equal(id.length, 20);
assert.equal(verify('0123456789ABCDEFGHWJ'), true);
assert.equal(verify(null), false);
assert.equal(isSID(id), true);
assert.equal(isFormattedSID(generateFormatted()), true);
assert.deepEqual(format('0123456789ABCDEFGHWJ'), { ok: true, data: '0123-4567-89AB-CDEF-GHWJ' });
assert.equal(parse('0123456789ABCDEFGHWK').code, 'CHECKSUM_MISMATCH');
assert.equal(fromBytes(Buffer.alloc(12)), '00000000000000000000');
assert.equal(fromBytes(Buffer.alloc(11)), null);
assert.equal(CROCKFORD_ALPHABET, '0123456789ABCDEFGHJKMNPQRSTVWXYZ');

assert.deepEqual(Object.keys(require('@smart-science/sid')).sort(), [
    'CROCKFORD_ALPHABET',
    'format',
    'fromBytes',
    'generate',
    'generateFormatted',
    'isFormattedSID',
    'isSID',
    'parse',
    'verify',
]);
assert.equal(require('@smart-science/sid/package.json').name, '@smart-science/sid');

console.log('CJS smoke test passed.');
