/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { parse, verify } from '../src/index';
import { mustParse, VALID_ID } from './helpers';

// -------------------------------------------------------------------
// 2. Test Suite: Checksum Properties & Transposition Limits
// -------------------------------------------------------------------

describe('Checksum Properties & Mathematical Limits', () => {
    describe('Transposition Invariants & Known Limits (v0.1 Algorithm)', () => {
        it('detects adjacent transpositions across all 14 payload pairs deterministically [F-46]', () => {
            // all adjacent pairs 0..1 through 13..14 have distinct values with distance != 16
            const valid = mustParse(VALID_ID);
            for (let i = 0; i < 14; i++) {
                const c1 = valid[i];
                const c2 = valid[i + 1];
                const swapped = `${valid.slice(0, i)}${c2}${c1}${valid.slice(i + 2)}`;
                expect(verify(swapped)).toBe(false);
            }
        });

        it('documents and asserts that pair 14-15 swap is NOT detected by v0.1 algorithm [F-46, F-52]', () => {
            // INVARIANT (Option B): In v0.1, position 14 has weight 1, and check char index 15 effectively has weight 1.
            // Swapping the last payload character and check character is NOT detected by the v0.1 algorithm.
            // Example from audit report: '0123456789ABCDEN' has check char 'N' (val 21) and pos 14 'E' (val 14).
            // Swapping them yields '0123456789ABCDNE', which still passes verification under v0.1.
            const valid = '0123456789ABCDEN';
            expect(verify(valid)).toBe(true);

            const lastPairSwapped = '0123456789ABCDNE';
            expect(verify(lastPairSwapped)).toBe(true); // Pinned v0.1 limitation
        });

        it('documents and asserts that jump transpositions (i <-> i+2) are NOT detected [F-52]', () => {
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
