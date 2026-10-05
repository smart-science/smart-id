// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import fc from 'fast-check';
import { CROCKFORD_ALPHABET, fromBytes, isSID, type SID } from '../src/index.js';
import { ALPHABET } from './helpers.js';

// -------------------------------------------------------------------
// 2. Configuration & Constants
// -------------------------------------------------------------------

const SEED = 0x51d_2026;
const NUM_RUNS = 2_000;

/** SHA-256 of the empty string: `e3b0c442 98fc1c14 9afbf4c8 ...`. */
const EMPTY_DIGEST = createHash('sha256').update('').digest();

// -------------------------------------------------------------------
// 3. Test Suite: CROCKFORD_ALPHABET
// -------------------------------------------------------------------

describe('CROCKFORD_ALPHABET', () => {
    it('is the 32-character Crockford Base32 alphabet without I, L, O, U', () => {
        expect(CROCKFORD_ALPHABET).toBe(ALPHABET);
        expect(CROCKFORD_ALPHABET).toHaveLength(32);
        expect(CROCKFORD_ALPHABET).not.toMatch(/[ILOU]/);
    });
});

// -------------------------------------------------------------------
// 4. Test Suite: fromBytes()
// -------------------------------------------------------------------

describe('fromBytes()', () => {
    describe('Deterministic Vectors', () => {
        it('maps 12 zero bytes to the all-zero SID', () => {
            expect(fromBytes(new Uint8Array(12))).toBe('00000000000000000000' as SID);
        });

        it('maps 12 0xFF bytes to all `Z` with check characters `5N`', () => {
            expect(fromBytes(new Uint8Array(12).fill(0xff))).toBe('ZZZZZZZZZZZZZZZZZZ5N' as SID);
        });

        it('reads bits MSB-first from a full SHA-256 digest', () => {
            // 0xE3 = 11100|011.. -> 28 ('W'), cross-checked against a BigInt reference implementation.
            expect(fromBytes(EMPTY_DIGEST)).toBe('WERC8GMRZGE196QVYK07' as SID);
            expect(fromBytes(EMPTY_DIGEST.subarray(0, 12))).toBe('WERC8GMRZGE196QVYK07' as SID);
        });

        it('accepts a Uint8Array view with a byte offset', () => {
            const padded = new Uint8Array(20);
            padded.set(EMPTY_DIGEST.subarray(0, 12), 8);
            expect(fromBytes(padded.subarray(8))).toBe('WERC8GMRZGE196QVYK07' as SID);
        });
    });

    describe('Bit Consumption', () => {
        it('ignores the low 6 bits of byte 11 and every byte after it', () => {
            const base = new Uint8Array(32);
            const expected = fromBytes(base);
            const tail = new Uint8Array(32);
            tail[11] = 0b0011_1111;
            tail.fill(0xff, 12);
            expect(fromBytes(tail)).toBe(expected);
        });

        it('changes the output when any of the first 90 bits flips', () => {
            const base = new Uint8Array(12);
            const expected = fromBytes(base);
            for (let bit = 0; bit < 90; bit++) {
                const flipped = new Uint8Array(12);
                flipped[bit >> 3] = 0x80 >> (bit & 7);
                expect(fromBytes(flipped)).not.toBe(expected);
            }
        });
    });

    describe('Property: Valid Output', () => {
        it('always returns a canonical SID for 12 to 64 bytes', () => {
            fc.assert(
                fc.property(fc.uint8Array({ minLength: 12, maxLength: 64 }), (bytes) => {
                    expect(isSID(fromBytes(bytes))).toBe(true);
                }),
                { seed: SEED, numRuns: NUM_RUNS },
            );
        });
    });

    describe('Invalid Input', () => {
        it('returns null for fewer than 12 bytes', () => {
            for (let length = 0; length < 12; length++) {
                expect(fromBytes(new Uint8Array(length))).toBeNull();
            }
        });

        it('returns null for non-Uint8Array input', () => {
            // runtime guard for JS callers; the cast only widens the parameter type.
            const call = fromBytes as (input: unknown) => SID | null;
            for (const input of [
                new Uint16Array(12),
                new Int8Array(12),
                new DataView(new ArrayBuffer(12)),
                new ArrayBuffer(12),
                Array.from({ length: 12 }, () => 0),
            ]) {
                expect(call(input)).toBeNull();
            }
        });

        it('accepts Buffer as a Uint8Array subclass', () => {
            expect(fromBytes(Buffer.alloc(12))).toBe('00000000000000000000' as SID);
        });

        it('accepts a Uint8Array from another realm', () => {
            const foreign: unknown = runInNewContext('new Uint8Array(12)');
            expect(foreign instanceof Uint8Array).toBe(false); // guards the expectation itself
            const call = fromBytes as (input: unknown) => SID | null;
            expect(call(foreign)).toBe('00000000000000000000' as SID);
            expect(call(runInNewContext('new Uint8ClampedArray(12)'))).toBeNull();
        });

        it('returns null for a view on a detached buffer', () => {
            const buffer = new ArrayBuffer(12);
            const view = new Uint8Array(buffer);
            structuredClone(buffer, { transfer: [buffer] });
            expect(buffer.detached).toBe(true);
            expect(fromBytes(view)).toBeNull();
        });
    });
});
