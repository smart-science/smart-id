/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

if (process.env.CI) {
    assert.equal(process.versions.bun, undefined, 'smoke tests must run under Node in CI to test dist/');
}

import { format, generate, generateFormatted, parse, verify } from '@smart-science/sid';

const id = generate();
assert.equal(id.length, 16);
assert.ok(verify(id));
assert.ok(verify(generateFormatted()));
assert.deepEqual(parse('0123-4567-89AB-CDEN'), { ok: true, data: '0123456789ABCDEN' });
assert.deepEqual(format('0123456789ABCDEN'), { ok: true, data: '0123-4567-89AB-CDEN' });
assert.equal(verify(null), false);

console.log('ESM smoke test passed.');
