/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

if (process.env.CI) {
    assert.equal(process.versions.bun, undefined, 'smoke tests must run under Node in CI to test dist/');
}

import { format, generate, generateFormatted, isFormattedSID, isSID, parse, verify } from '@smart-science/sid';

const id = generate();
assert.equal(id.length, 16);
assert.ok(verify(id));
assert.ok(verify(generateFormatted()));
assert.deepEqual(parse('0123-4567-89AB-CDE7'), { ok: true, data: '0123456789ABCDE7' });
assert.deepEqual(format('0123456789ABCDE7'), { ok: true, data: '0123-4567-89AB-CDE7' });
assert.equal(verify(null), false);
assert.equal(isSID(id), true);
assert.equal(isSID('0123456789abcde7'), false);
assert.equal(isFormattedSID(generateFormatted()), true);
assert.deepEqual(parse(null), { ok: false, code: 'NOT_A_STRING', error: 'Expected string input, received null' });
assert.equal(parse('0123456789ABCDEN').code, 'CHECKSUM_MISMATCH');
const api = await import('@smart-science/sid');
assert.deepEqual(Object.keys(api).sort(), [
    'format',
    'generate',
    'generateFormatted',
    'isFormattedSID',
    'isSID',
    'parse',
    'verify',
]);

console.log('ESM smoke test passed.');
