/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, isFormattedSID, isSID, parse, verify } from '../src/index';

// -------------------------------------------------------------------
// 2. Hostile & Unusual Inputs
// -------------------------------------------------------------------

const revocable = Proxy.revocable({}, {});
revocable.revoke();

const throwOnAccess = (): never => {
    throw new Error('accessed');
};

const HOSTILE_INPUTS: readonly unknown[] = [
    undefined,
    null,
    0,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    10n,
    true,
    Symbol('sid'),
    '',
    '\uD800',
    'x'.repeat(1_000_000),
    {},
    [],
    [...'0123456789ABCDE7'],
    new String('0123456789ABCDE7'),
    Object.create(null),
    () => {},
    new Date(),
    new Uint8Array(16),
    revocable.proxy,
    { toString: throwOnAccess, valueOf: throwOnAccess, [Symbol.toPrimitive]: throwOnAccess },
    Object.defineProperty({}, 'length', { get: throwOnAccess }),
    new Proxy({}, { get: throwOnAccess, has: throwOnAccess, getPrototypeOf: throwOnAccess }),
];

// -------------------------------------------------------------------
// 3. Test Suite: Never-Throw Contract
// -------------------------------------------------------------------

describe('Validation functions never throw', () => {
    it('verify, isSID, and isFormattedSID return false for hostile inputs', () => {
        for (const input of HOSTILE_INPUTS) {
            expect(verify(input)).toBe(false);
            expect(isSID(input)).toBe(false);
            expect(isFormattedSID(input)).toBe(false);
        }
    });

    it('parse and format return failure results for hostile inputs', () => {
        for (const input of HOSTILE_INPUTS) {
            expect(parse(input).ok).toBe(false);
            expect(format(input).ok).toBe(false);
        }
    });
});
