/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, isFormattedSID, isSID, parse, verify } from '../src/index';
import { quad, VALID_ID, VALID_ID_2, VALID_ID_ALL_ZERO } from './helpers';

// -------------------------------------------------------------------
// 2. Seeded PRNG, Character Pool & Input Generator
// -------------------------------------------------------------------

/**
 * 32-bit Mulberry32 seeded deterministic PRNG.
 * Guarantees identical sequence across runs so any edge-case failure can be reproduced.
 */
function createPRNG(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const CHAR_POOL = [
    // Crockford Base32 alphabet
    ...'0123456789ABCDEFGHJKMNPQRSTVWXYZ',
    // Lowercase Crockford alphabet
    ...'abcdefghjkmnpqrstvwxyz',
    // Ambiguous, repair and excluded characters
    ...'IiLlOoUu',
    // Delimiters & whitespace
    ...'-- \t\n_.:/',
    // Unicode case-mapping characters
    ...'ßıſﬁÄÖÜ',
    // Multibyte, emoji & invisible characters
    'Ā',
    '�',
    '😊',
    '🔥',
    '​',
];

/** Valid seed IDs that mutations start from, so a meaningful share of inputs stays parseable. */
const SEED_IDS = [VALID_ID, VALID_ID_2, VALID_ID_ALL_ZERO, 'ZZZZZZZZZZZZZZZX', 'K4MR7T2PQ9XH3WNY'];

const SEED = 0x51d_2026;
const ITERATIONS = 10_000;

/** Builds one fuzz input: either a fully random string or a lightly mutated valid ID. */
function nextInput(prng: () => number): string {
    const pick = <T>(items: readonly T[]): T => items[Math.floor(prng() * items.length)] as T;

    if (prng() < 0.25) {
        // Fully random string of length 0 to 28
        let str = '';
        const len = Math.floor(prng() * 29);
        for (let j = 0; j < len; j++) {
            str += pick(CHAR_POOL);
        }
        return str;
    }

    // Mutated valid ID: raw or formatted, optional case change, 0-2 edits, optional whitespace
    const base = pick(SEED_IDS);
    let str = prng() < 0.5 ? base : quad(base);
    if (prng() < 0.3) {
        str = str.toLowerCase();
    }

    const edits = Math.floor(prng() * 3);
    for (let e = 0; e < edits; e++) {
        const i = Math.floor(prng() * str.length);
        const op = prng();
        if (op < 0.4) {
            str = str.slice(0, i) + pick(CHAR_POOL) + str.slice(i + 1); // replace
        } else if (op < 0.6) {
            str = str.slice(0, i) + pick(CHAR_POOL) + str.slice(i); // insert
        } else if (op < 0.8) {
            str = str.slice(0, i) + str.slice(i + 1); // delete
        } else {
            str = str.slice(0, i) + (str[i + 1] ?? '') + (str[i] ?? '') + str.slice(i + 2); // swap neighbours
        }
    }

    if (prng() < 0.2) {
        str = ` \t${str}\n`;
    }
    return str;
}

// -------------------------------------------------------------------
// 3. Test Suite: Seeded Property Consistency & Fuzzing
// -------------------------------------------------------------------

describe('Property Consistency & Seeded Fuzz Suite', () => {
    it('preserves all invariants across 10,000 deterministic pseudo-random inputs', () => {
        const prng = createPRNG(SEED);
        const CANONICAL_REGEX = /^[0-9A-HJKMNP-TV-Z]{16}$/;

        let successCount = 0;

        for (let iter = 0; iter < ITERATIONS; iter++) {
            const str = nextInput(prng);
            const context = `seed=${SEED} iter=${iter} input=${JSON.stringify(str)}`;

            // Invariant 1: No function ever throws (a throw fails the test with the context below)
            const vResult = verify(str);
            const pResult = parse(str);
            const fResult = format(str);

            // Invariant 2: Tri-state agreement across verify(), parse().ok, format().ok
            expect(pResult.ok, context).toBe(vResult);
            expect(fResult.ok, context).toBe(vResult);

            // Invariant 3: Success branch property guarantees
            if (pResult.ok && fResult.ok) {
                successCount++;
                const canonical = pResult.data;

                expect(CANONICAL_REGEX.test(canonical), context).toBe(true);
                expect(parse(canonical), context).toEqual({ ok: true, data: canonical });
                expect(fResult.data, context).toBe(quad(canonical));
                expect(isSID(canonical), context).toBe(true);
                expect(isFormattedSID(fResult.data), context).toBe(true);
            }
        }

        // Sanity check: the generator must exercise the success branch, not only rejections
        expect(successCount).toBeGreaterThan(ITERATIONS * 0.2);
        expect(successCount).toBeLessThan(ITERATIONS * 0.8);
    });
});
