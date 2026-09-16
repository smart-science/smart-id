/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { format, isFormattedSID, isSID, parse, verify } from '../src/index';
import { ALPHABET, quad, VALID_ID, VALID_ID_2, VALID_ID_ALL_ZERO } from './helpers';

// -------------------------------------------------------------------
// 2. Configuration & Constants
// -------------------------------------------------------------------

/**
 * Fixed seed keeps CI deterministic. On failure, fast-check reports the seed, the replay path,
 * and the shrunk counterexample; pass them back via `{ seed, path }` to reproduce it.
 */
const SEED = 0x51d_2026;
const NUM_RUNS = 10_000;

const CANONICAL_REGEX = /^[0-9A-HJKMNP-TV-Z]{16}$/;

/** `true` if every UTF-16 code unit is ASCII. */
function isAscii(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) > 0x7f) {
            return false;
        }
    }
    return true;
}

/** Valid IDs that mutations start from; repeated `1` and `S` expose case-mapping lookalikes (`ı`, `ſ`). */
const SEED_IDS = [
    VALID_ID,
    VALID_ID_2,
    VALID_ID_ALL_ZERO,
    'ZZZZZZZZZZZZZZZZ',
    'K4MR7T2PQ9XH3WNA',
    '1111111111111111',
    'SSSSSSSSSSSSSSSS',
] as const;

/** Non-ASCII characters that uppercase, fold, or trim into something ASCII-like. */
const NON_ASCII_TRICKY = ['ß', 'ı', 'ſ', 'ﬁ', 'Ä', 'ｌ', '\u00A0', '\u200B', '\uFEFF', '\u2010', '😊', '\uD800'];

/** Characters that stress normalization: alphabet in both cases, repairs, excluded, delimiters, Unicode. */
const TRICKY_CHARS = [...ALPHABET, ...ALPHABET.toLowerCase(), ...'IiLlOoUu-_.: \t\n', ...NON_ASCII_TRICKY];

// -------------------------------------------------------------------
// 3. Arbitraries
// -------------------------------------------------------------------

/** A single character: mostly tricky picks, sometimes any Unicode code point. */
const anyChar = fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...TRICKY_CHARS) },
    { weight: 1, arbitrary: fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }) },
);

/** A valid ID, raw or formatted, optionally lowercased, lightly edited, and whitespace-padded. */
const mutatedId = fc
    .record({
        base: fc.constantFrom(...SEED_IDS),
        formatted: fc.boolean(),
        lowercase: fc.boolean(),
        edits: fc.array(
            fc.record({
                op: fc.constantFrom('replace', 'insert', 'delete', 'swap'),
                pos: fc.nat(),
                char: anyChar,
            }),
            { maxLength: 2 },
        ),
        padding: fc.constantFrom('', ' ', '\t', '\n', ' \t\n', '\u00A0'),
    })
    .map(({ base, formatted, lowercase, edits, padding }) => {
        let str: string = formatted ? quad(base) : base;
        if (lowercase) {
            str = str.toLowerCase();
        }
        for (const { op, pos, char } of edits) {
            const i = pos % (str.length + 1);
            if (op === 'replace') {
                str = str.slice(0, i) + char + str.slice(i + 1);
            } else if (op === 'insert') {
                str = str.slice(0, i) + char + str.slice(i);
            } else if (op === 'delete') {
                str = str.slice(0, i) + str.slice(i + 1);
            } else {
                str = str.slice(0, i) + str.slice(i + 1, i + 2) + str.slice(i, i + 1) + str.slice(i + 2);
            }
        }
        return padding + str + padding;
    });

/** A valid ID with exactly one character replaced by a non-ASCII character. */
const idWithNonAsciiChar = fc
    .record({
        base: fc.constantFrom(...SEED_IDS),
        pos: fc.integer({ min: 0, max: 15 }),
        char: fc.oneof(
            fc.constantFrom(...NON_ASCII_TRICKY),
            fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }).filter((c) => !isAscii(c)),
        ),
    })
    .map(({ base, pos, char }) => base.slice(0, pos) + char + base.slice(pos + 1));

// -------------------------------------------------------------------
// 4. Invariants
// -------------------------------------------------------------------

/** Asserts every cross-function invariant for one input; returns whether the input parsed. */
function assertInvariants(input: unknown): boolean {
    const valid = verify(input);
    const parsed = parse(input);
    const formatted = format(input);

    // verify(), parse().ok, and format().ok always agree
    expect(parsed.ok).toBe(valid);
    expect(formatted.ok).toBe(valid);

    if (!parsed.ok || !formatted.ok) {
        // format() delegates failures to parse() unchanged; strict guards never accept invalid input
        expect<unknown>(formatted).toEqual(parsed);
        expect(isSID(input)).toBe(false);
        expect(isFormattedSID(input)).toBe(false);
        return false;
    }

    const canonical = parsed.data;
    expect(typeof input).toBe('string');
    // only ASCII survives normalization (Unicode whitespace is trimmed first)
    expect(isAscii((input as string).trim())).toBe(true);
    expect(canonical).toMatch(CANONICAL_REGEX);
    // parsing is idempotent and formatting is the quad grouping of the canonical ID
    expect(parse(canonical)).toEqual({ ok: true, data: canonical });
    expect(formatted.data).toBe(quad(canonical));
    // strict guards accept exactly the canonical forms
    expect(isSID(input)).toBe(input === canonical);
    expect(isFormattedSID(input)).toBe(input === formatted.data);
    expect(isSID(canonical)).toBe(true);
    expect(isFormattedSID(formatted.data)).toBe(true);
    return true;
}

// -------------------------------------------------------------------
// 5. Test Suite: Property-Based Consistency (fast-check)
// -------------------------------------------------------------------

describe('Property-based consistency (fast-check)', () => {
    it('starts mutations from canonical valid IDs', () => {
        for (const id of SEED_IDS) {
            expect(isSID(id)).toBe(true);
        }
    });

    it('holds all invariants for lightly mutated valid IDs', () => {
        let parsedCount = 0;
        fc.assert(
            fc.property(mutatedId, (input) => {
                if (assertInvariants(input)) {
                    parsedCount++;
                }
            }),
            { seed: SEED, numRuns: NUM_RUNS },
        );

        // the generator must exercise both the success and the failure branches
        expect(parsedCount).toBeGreaterThan(NUM_RUNS * 0.2);
        expect(parsedCount).toBeLessThan(NUM_RUNS * 0.8);
    });

    it('holds all invariants for arbitrary Unicode strings', () => {
        fc.assert(
            fc.property(fc.string({ unit: 'binary', maxLength: 24 }), (input) => {
                assertInvariants(input);
            }),
            { seed: SEED, numRuns: NUM_RUNS },
        );
    });

    it('holds all invariants for arbitrary JavaScript values', () => {
        fc.assert(
            fc.property(fc.anything({ maxDepth: 2 }), (input) => {
                assertInvariants(input);
            }),
            { seed: SEED, numRuns: 2_000 },
        );
    });

    it('rejects valid IDs with any single character replaced by a non-ASCII character', () => {
        fc.assert(
            fc.property(idWithNonAsciiChar, (input) => {
                expect(verify(input)).toBe(false);
                expect(isSID(input)).toBe(false);
            }),
            { seed: SEED, numRuns: NUM_RUNS },
        );
    });
});
