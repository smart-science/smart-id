// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it, spyOn } from 'bun:test';
import { generate, generateFormatted, parse, type SID, verify } from '../src/index.js';
import { ALPHABET } from './helpers.js';

// -------------------------------------------------------------------
// 2. Test Suite: generate() & generateFormatted()
// -------------------------------------------------------------------

describe('generate() & generateFormatted()', () => {
    describe('Basic Output Structure & Format', () => {
        it('uses every alphabet character and nothing outside the alphabet', () => {
            const bucketCounts = new Uint32Array(32);
            for (let i = 0; i < 1_000; i++) {
                const id = generate();
                for (let j = 0; j < 20; j++) {
                    const char = id[j] ?? '';
                    const idx = ALPHABET.indexOf(char);
                    expect(idx).not.toBe(-1);
                    const currentCount = bucketCounts[idx] ?? 0;
                    bucketCounts[idx] = currentCount + 1;
                }
            }
            // every single Crockford Base32 symbol must appear at least once across 20,000 generated characters (incl. check characters).
            expect(bucketCounts.every((count) => count > 0)).toBe(true);
        });

        it('generates a valid quad-grouped FormattedSID that roundtrips cleanly with parse()', () => {
            const formatted = generateFormatted();
            expect(formatted).toHaveLength(24);
            expect(formatted).toMatch(
                /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
            );
            expect(verify(formatted)).toBe(true);

            const parsed = parse(formatted);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.data).toHaveLength(20);
                expect(parsed.data).toBe(formatted.replace(/-/g, '') as SID);
            }
        });
    });

    describe('Deterministic Generation with Mocked Web Crypto', () => {
        it('produces all-zero SID when random bytes are all 0x00', () => {
            const spy = spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: ArrayBufferView) => {
                (arr as Uint8Array).fill(0x00);
                return arr;
            });

            try {
                const id = generate();
                expect(id).toBe('00000000000000000000' as SID);
                expect(verify(id)).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });

        it('proves bitmasking (& 31) when random bytes are all 0xFF', () => {
            // 0xFF & 31 = 31 ('Z'). 18 'Z's produce check characters '5N'.
            const spy = spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: ArrayBufferView) => {
                (arr as Uint8Array).fill(0xff);
                return arr;
            });

            try {
                const id = generate();
                expect(id).toBe('ZZZZZZZZZZZZZZZZZZ5N' as SID);
                expect(verify(id)).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });

        it('generates exact canonical identifier from fixed byte sequence', () => {
            // payload values 0..17 ('0123456789ABCDEFGH') with high bit variation
            const fixedSequence = [
                0, // '0'
                1 | 0x40, // '1' with high bits
                2 | 0x80, // '2' with high bits
                3, // '3'
                4 | 0x20, // '4'
                5, // '5'
                6 | 0xe0, // '6'
                7, // '7'
                8, // '8'
                9 | 0x60, // '9'
                10, // 'A'
                11 | 0x80, // 'B'
                12, // 'C'
                13, // 'D'
                14 | 0xa0, // 'E'
                15, // 'F'
                16 | 0xc0, // 'G'
                17, // 'H'
            ];

            const spy = spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: ArrayBufferView) => {
                const u8 = arr as Uint8Array;
                for (let i = 0; i < fixedSequence.length; i++) {
                    u8[i] = fixedSequence[i] ?? 0;
                }
                return arr;
            });

            try {
                const id = generate();
                expect(id).toBe('0123456789ABCDEFGHWJ' as SID);
                expect(verify(id)).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });
    });

    describe('Missing Web Crypto Runtime Behavior', () => {
        it('throws a descriptive TypeError when Web Crypto or getRandomValues is missing', () => {
            const MESSAGE =
                'generate() requires Web Crypto (globalThis.crypto.getRandomValues), which this runtime lacks';
            const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
            try {
                for (const value of [undefined, null, {}, { getRandomValues: 'not a function' }]) {
                    // Temporarily mask crypto
                    Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });

                    expect(() => generate()).toThrow(new TypeError(MESSAGE));
                    expect(() => generateFormatted()).toThrow(new TypeError(MESSAGE));
                }
            } finally {
                if (originalDescriptor) {
                    Object.defineProperty(globalThis, 'crypto', originalDescriptor);
                }
            }
        });
    });
});
