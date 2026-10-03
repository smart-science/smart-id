// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, parse, type SID, verify } from '../src/index.js';
import { ALPHABET, quad, VALID_ID } from './helpers.js';

// -------------------------------------------------------------------
// 2. Constants & Golden Vectors
// -------------------------------------------------------------------

const PAYLOAD_LENGTH = 18;
const TOTAL_LENGTH = 20;

/** Ordered pairs of different characters: 32 * 31. */
const CHAR_PAIRS = 992;

/**
 * Golden Test Vectors for the v0.3 algorithm.
 * Pins checksum calculation to prevent accidental regressions during refactors.
 */
interface GoldenVector {
    readonly payload: string;
    readonly expectedSID: SID;
}

const GOLDEN_VECTORS: readonly GoldenVector[] = [
    { payload: '000000000000000000', expectedSID: '00000000000000000000' as SID },
    { payload: 'ZZZZZZZZZZZZZZZZZZ', expectedSID: 'ZZZZZZZZZZZZZZZZZZ5N' as SID },
    { payload: '0123456789ABCDEFGH', expectedSID: '0123456789ABCDEFGHWJ' as SID },
    { payload: 'VWXYZ0123456789ABC', expectedSID: 'VWXYZ0123456789ABCGV' as SID },
    { payload: 'GGGGGGGGGGGGGGGGGG', expectedSID: 'GGGGGGGGGGGGGGGGGGNG' as SID },
    { payload: 'K4MR7T2PQ9XH3WNB8D', expectedSID: 'K4MR7T2PQ9XH3WNB8DKM' as SID },
];

const KNOWN_INVALID_VECTORS: readonly string[] = [
    '0123456789ABCDEFGHW0', // Second check character mismatch ('0' instead of 'J')
    '00000000000000000001', // Second check character mismatch on all-zero payload ('1' instead of '0')
    '0123456789ABCDEFGH0J', // First check character mismatch ('0' instead of 'W')
    'VWXYZ0123456789ABCVG', // Check characters swapped ('VG' instead of 'GV')
    'GGGGGGGGGGGGGGGGGGGN', // Check characters swapped ('GN' instead of 'NG')
    'K4MR7T2PQ9XH3WNB8DMK', // Check characters swapped ('MK' instead of 'KM')
];

/** Payload positions varied to reach every check value: weights 1, 17, 18, with substitutes 16 and 15. */
const TUNING_POSITIONS = [0, 16, 17, 15, 14] as const;

/**
 * One valid ID for every ordered pair of different characters at positions `i < j`.
 * Unvaried payload characters are '0' (value 0), so the weighted sum only covers the varied positions.
 */
function validIdsForEveryCharPair(i: number, j: number): string[] {
    const varied =
        j < PAYLOAD_LENGTH
            ? [i, j]
            : [...(i < PAYLOAD_LENGTH ? [i] : []), ...TUNING_POSITIONS.filter((p) => p !== i).slice(0, 3)];
    const values = new Array<number>(PAYLOAD_LENGTH).fill(0);
    const found = new Map<number, string>();

    for (let n = 0; n < 32 ** varied.length && found.size < CHAR_PAIRS; n++) {
        let sum = 0;
        for (let k = 0; k < varied.length; k++) {
            const p = varied[k] ?? 0;
            const value = Math.floor(n / 32 ** k) % 32;
            values[p] = value;
            sum += value * (p + 1);
        }
        const check = sum & 0x3ff;
        const symbols = [...values, (check >> 5) & 31, check & 31];
        const a = symbols[i] ?? 0;
        const b = symbols[j] ?? 0;
        if (a !== b && !found.has(a * 32 + b)) {
            found.set(a * 32 + b, symbols.map((v) => ALPHABET[v]).join(''));
        }
    }
    return [...found.values()];
}

// -------------------------------------------------------------------
// 3. Test Suite: Checksum Properties & Mathematical Limits
// -------------------------------------------------------------------

describe('Checksum Properties & Mathematical Limits', () => {
    describe('Golden Test Vectors (v0.3 Algorithm)', () => {
        it('verifies all golden test vectors are valid under v0.3 algorithm', () => {
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

        it('reports a checksum mismatch at index 18 before an invalid character at index 19', () => {
            expect(parse('0123456789ABCDEFGH0?')).toEqual({
                ok: false,
                code: 'CHECKSUM_MISMATCH',
                error: 'Invalid ID "0123456789ABCDEFGH0?" failed checksum validation',
            });
        });
    });

    describe('Single-Character Substitution Detection', () => {
        it('detects all possible single-character substitutions across all 20 positions', () => {
            // exhaustively mutate every position (0..19) with all 31 alternate Crockford characters.
            const valid = VALID_ID;
            for (let i = 0; i < TOTAL_LENGTH; i++) {
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

    describe('Transposition Detection (v0.3 Algorithm)', () => {
        it('detects every swap of two different characters across all 20 positions', () => {
            // Exhaustive over all position pairs (i < j) and all ordered character pairs (a != b).
            // Payload swaps change the sum by (a - b) * (j - i), at most 31 * 17 < 1024.
            // Swaps involving a check character never reproduce the 10-bit check value.
            let swaps = 0;
            for (let i = 0; i < TOTAL_LENGTH; i++) {
                for (let j = i + 1; j < TOTAL_LENGTH; j++) {
                    const ids = validIdsForEveryCharPair(i, j);
                    expect(ids).toHaveLength(CHAR_PAIRS);

                    for (const id of ids) {
                        expect(verify(id)).toBe(true);
                        const swapped = [...id];
                        swapped[i] = id[j] ?? '';
                        swapped[j] = id[i] ?? '';
                        expect(verify(swapped.join(''))).toBe(false);
                        swaps++;
                    }
                }
            }

            // 190 position pairs x 992 ordered character pairs
            expect(swaps).toBe(190 * CHAR_PAIRS);
        });
    });

    describe('False Acceptance Rate (v0.3 Algorithm)', () => {
        it('accepts exactly one of the 1024 check pairs per payload', () => {
            // Every golden payload and every single-character variant of the VALID_ID payload.
            const payloads = new Set(GOLDEN_VECTORS.map(({ payload }) => payload));
            const base = VALID_ID.slice(0, PAYLOAD_LENGTH);
            for (let i = 0; i < PAYLOAD_LENGTH; i++) {
                for (const c of ALPHABET) {
                    payloads.add(`${base.slice(0, i)}${c}${base.slice(i + 1)}`);
                }
            }

            for (const payload of payloads) {
                let accepted = 0;
                for (const high of ALPHABET) {
                    for (const low of ALPHABET) {
                        if (verify(payload + high + low)) {
                            accepted++;
                        }
                    }
                }
                expect(accepted).toBe(1);
            }
        });
    });
});
