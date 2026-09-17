/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, parse, type SID, verify } from '../src/index';
import { ALPHABET, quad, VALID_ID } from './helpers';

// -------------------------------------------------------------------
// 2. Constants & Golden Vectors
// -------------------------------------------------------------------

/**
 * Golden Test Vectors for the v0.2 algorithm.
 * Pins checksum calculation to prevent accidental regressions during refactors.
 */
interface GoldenVector {
    readonly payload: string;
    readonly expectedSID: SID;
}

const GOLDEN_VECTORS: readonly GoldenVector[] = [
    { payload: '000000000000000', expectedSID: '0000000000000000' as SID },
    { payload: 'ZZZZZZZZZZZZZZZ', expectedSID: 'ZZZZZZZZZZZZZZZZ' as SID },
    { payload: '0123456789ABCDE', expectedSID: '0123456789ABCDE7' as SID },
    { payload: 'VWXYZ0123456789', expectedSID: 'VWXYZ01234567892' as SID },
    { payload: 'GGGGGGGGGGGGGGG', expectedSID: 'GGGGGGGGGGGGGGGG' as SID },
    { payload: 'K4MR7T2PQ9XH3WN', expectedSID: 'K4MR7T2PQ9XH3WNA' as SID },
];

const KNOWN_INVALID_VECTORS: readonly string[] = [
    '0123456789ABCDE0', // Single substitution at check position ('0' instead of '7')
    '0000000000000001', // Check character mismatch on all-zero payload ('1' instead of '0')
    'VWXYZ01234567890', // Check character mismatch ('0' instead of '2')
    'GGGGGGGGGGGGGGGA', // Check character mismatch ('A' instead of 'G')
    'K4MR7T2PQ9XH3WNZ', // Check character mismatch ('Z' instead of 'A')
];

// -------------------------------------------------------------------
// 3. Test Suite: Checksum Properties & Mathematical Limits
// -------------------------------------------------------------------

describe('Checksum Properties & Mathematical Limits', () => {
    describe('Golden Test Vectors (v0.2 Algorithm)', () => {
        it('verifies all golden test vectors are valid under v0.2 algorithm', () => {
            for (const { payload, expectedSID } of GOLDEN_VECTORS) {
                expect(expectedSID.startsWith(payload)).toBe(true);
                expect(verify(expectedSID)).toBe(true);

                const parsed = parse(expectedSID);
                expect(parsed).toEqual({ ok: true, data: expectedSID });

                const formatted = format(expectedSID);
                expect(formatted).toEqual({ ok: true, data: quad(expectedSID) });
            }
        });

        it('rejects known-invalid test vectors with checksum mismatch', () => {
            for (const invalidID of KNOWN_INVALID_VECTORS) {
                expect(verify(invalidID)).toBe(false);

                const res = parse(invalidID);
                expect(res.ok).toBe(false);
                if (!res.ok) {
                    expect(res.code).toBe('CHECKSUM_MISMATCH');
                    expect(res.error).toBe(`Invalid ID ${JSON.stringify(invalidID)} failed checksum validation`);
                }

                const formatRes = format(invalidID);
                expect(formatRes.ok).toBe(false);
            }
        });
    });

    describe('Single-Character Substitution Detection', () => {
        it('detects all possible single-character substitutions across all 16 positions', () => {
            // exhaustively mutate every position (0..15) with all 31 alternate Crockford characters.
            const valid = VALID_ID;
            for (let i = 0; i < 16; i++) {
                const originalChar = valid[i];
                for (const alternateChar of ALPHABET) {
                    if (alternateChar === originalChar) {
                        continue;
                    }
                    const mutated = `${valid.slice(0, i)}${alternateChar}${valid.slice(i + 1)}`;
                    expect(verify(mutated)).toBe(false);
                }
            }
        });
    });

    describe('Transposition Detection (v0.2 Algorithm)', () => {
        it('detects every two-position swap unless the weights match or the values differ by 16', () => {
            // Exhaustive over all position pairs (i < j) and all ordered character pairs (a != b).
            // A swap changes the weighted sum by (weight(i) - weight(j)) * (value(a) - value(b)).
            // It stays invisible modulo 32 when the weights are equal, or when the weights differ
            // (by 2) and the values differ by exactly 16, because 2 * 16 = 32.
            const weight = (position: number): number => (position % 2 === 0 ? 1 : 3);
            const withCheck = (payload: string): string =>
                payload + ([...ALPHABET].find((c) => verify(payload + c)) ?? '');

            let swaps = 0;
            for (let i = 0; i < 16; i++) {
                for (let j = i + 1; j < 16; j++) {
                    for (const a of ALPHABET) {
                        for (const x of ALPHABET) {
                            const chars = [...'0'.repeat(15)];
                            chars[i] = a;
                            // For j = 15 the check character is derived, so vary another payload
                            // position to make the check character take every value.
                            chars[j < 15 ? j : i === 0 ? 1 : 0] = x;
                            const id = withCheck(chars.join(''));
                            const b = id[j] ?? '';
                            if (a === b) {
                                continue;
                            }

                            const swapped = [...id];
                            swapped[i] = b;
                            swapped[j] = a;
                            const undetectable =
                                weight(i) === weight(j) || Math.abs(ALPHABET.indexOf(a) - ALPHABET.indexOf(b)) === 16;
                            expect(verify(swapped.join(''))).toBe(undetectable);
                            swaps++;
                        }
                    }
                }
            }

            // 120 position pairs x 992 ordered character pairs
            expect(swaps).toBe(120 * 992);
        });
    });
});
