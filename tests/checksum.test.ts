/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, parse, type SID, verify } from '../src/index';
import { ALPHABET, mustParse, quad, VALID_ID } from './helpers';

// -------------------------------------------------------------------
// 2. Constants & Golden Vectors
// -------------------------------------------------------------------

/**
 * Golden Test Vectors for the v0.1 algorithm.
 * Pins checksum calculation to prevent accidental regressions during refactors.
 */
interface GoldenVector {
    readonly payload: string;
    readonly expectedSID: SID;
}

const GOLDEN_VECTORS: readonly GoldenVector[] = [
    { payload: '000000000000000', expectedSID: '0000000000000000' as SID },
    { payload: 'ZZZZZZZZZZZZZZZ', expectedSID: 'ZZZZZZZZZZZZZZZX' as SID },
    { payload: '0123456789ABCDE', expectedSID: '0123456789ABCDEN' as SID },
    { payload: 'VWXYZ0123456789', expectedSID: 'VWXYZ01234567896' as SID },
    { payload: 'GGGGGGGGGGGGGGG', expectedSID: 'GGGGGGGGGGGGGGGG' as SID },
    { payload: 'K4MR7T2PQ9XH3WN', expectedSID: 'K4MR7T2PQ9XH3WNY' as SID },
];

const KNOWN_INVALID_VECTORS: readonly string[] = [
    '0123456789ABCDEA', // Single substitution at check position ('A' instead of 'N')
    '0000000000000001', // Check character mismatch on all-zero payload ('1' instead of '0')
    'VWXYZ01234567890', // Check character mismatch ('0' instead of '6')
    'GGGGGGGGGGGGGGGA', // Check character mismatch ('A' instead of 'G')
    'K4MR7T2PQ9XH3WNZ', // Check character mismatch ('Z' instead of 'Y')
];

// -------------------------------------------------------------------
// 3. Test Suite: Checksum Properties & Mathematical Limits
// -------------------------------------------------------------------

describe('Checksum Properties & Mathematical Limits', () => {
    describe('Golden Test Vectors (v0.1 Algorithm)', () => {
        it('verifies all golden test vectors are valid under v0.1 algorithm', () => {
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
                    expect(res.error).toBe(`Invalid ID: '${invalidID}' failed checksum validation`);
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

    describe('Transposition Invariants & Known Limits (v0.1 Algorithm)', () => {
        it('detects adjacent transpositions across all 14 payload pairs deterministically', () => {
            // all adjacent pairs 0..1 through 13..14 have distinct values with distance != 16
            const valid = mustParse(VALID_ID);
            for (let i = 0; i < 14; i++) {
                const c1 = valid[i];
                const c2 = valid[i + 1];
                const swapped = `${valid.slice(0, i)}${c2}${c1}${valid.slice(i + 2)}`;
                expect(verify(swapped)).toBe(false);
            }
        });

        it('documents and asserts that pair 14-15 swap is NOT detected by v0.1 algorithm', () => {
            // INVARIANT (Option B): In v0.1, position 14 has weight 1, and check char index 15 effectively has weight 1.
            // Swapping the last payload character and check character is NOT detected by the v0.1 algorithm.
            // Example from audit report: '0123456789ABCDEN' has check char 'N' (val 21) and pos 14 'E' (val 14).
            // Swapping them yields '0123456789ABCDNE', which still passes verification under v0.1.
            const valid = '0123456789ABCDEN';
            expect(verify(valid)).toBe(true);

            const lastPairSwapped = '0123456789ABCDNE';
            expect(verify(lastPairSwapped)).toBe(true); // Pinned v0.1 limitation
        });

        it('documents and asserts that jump transpositions (i <-> i+2) are NOT detected', () => {
            // INVARIANT: Alternating 1/3 weights give positions i and i+2 the exact same weight.
            // Swapping characters at positions i and i+2 leaves the weighted sum completely unchanged.
            const valid = mustParse(VALID_ID); // '0123456789ABCDEN'
            for (let i = 0; i < 13; i++) {
                const c1 = valid[i];
                const c2 = valid[i + 1];
                const c3 = valid[i + 2];
                // Swap c1 and c3 (i <-> i+2)
                const jumpSwapped = `${valid.slice(0, i)}${c3}${c2}${c1}${valid.slice(i + 3)}`;
                expect(verify(jumpSwapped)).toBe(true); // Pinned mathematical limit of alternating 1/3 weights
            }
        });

        it('verifies documented delta-16 transposition boundary invariant', () => {
            // INVARIANT: modulo-32 arithmetic cannot detect adjacent transpositions with character distance 16.
            // '0' (val 0) and 'G' (val 16) have delta = 16 (2 * 16 = 32 = 0 mod 32).
            const valid = '00000000000000GG';
            expect(verify(valid)).toBe(true);

            // swapping '0G' to 'G0' yields equivalent sum modulo 32.
            const swappedDelta16 = '0000000000000G0G';
            expect(verify(swappedDelta16)).toBe(true);
        });
    });
});
