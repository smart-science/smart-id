/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it, spyOn } from 'bun:test';
import { generate, generateFormatted, parse, type SID, verify } from '../src/index';
import { ALPHABET } from './helpers';

// -------------------------------------------------------------------
// 2. Test Suite: generate() & generateFormatted()
// -------------------------------------------------------------------

describe('generate() & generateFormatted()', () => {
    describe('Basic Output Structure & Format', () => {
        it('guarantees complete alphabet utilization and zero forbidden characters', () => {
            // assert zero forbidden characters `/[ILOUilou]/` and bucket spread across 1,000 samples.
            const bucketCounts = new Uint32Array(32);
            for (let i = 0; i < 1_000; i++) {
                const id = generate();
                expect(id).not.toMatch(/[ILOUilou]/);
                for (let j = 0; j < 15; j++) {
                    const char = id[j] ?? '';
                    const idx = ALPHABET.indexOf(char);
                    expect(idx).not.toBe(-1);
                    const currentCount = bucketCounts[idx] ?? 0;
                    bucketCounts[idx] = currentCount + 1;
                }
            }
            // every single Crockford Base32 symbol must appear at least once across 15,000 generated characters.
            expect(bucketCounts.every((count) => count > 0)).toBe(true);
        });

        it('generates a valid quad-grouped FormattedSID matching expected pattern', () => {
            const formatted = generateFormatted();
            expect(formatted).toHaveLength(19);
            expect(formatted).toMatch(
                /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
            );
            expect(verify(formatted)).toBe(true);
        });

        it('roundtrips cleanly with parse()', () => {
            const formatted = generateFormatted();
            const parsed = parse(formatted);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.data).toHaveLength(16);
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
                expect(id).toBe('0000000000000000' as SID);
                expect(verify(id)).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });

        it('proves bitmasking (& 31) when random bytes are all 0xFF', () => {
            // 0xFF & 31 = 31 ('Z'). 15 'Z's produce check character 'X'.
            const spy = spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr: ArrayBufferView) => {
                (arr as Uint8Array).fill(0xff);
                return arr;
            });

            try {
                const id = generate();
                expect(id).toBe('ZZZZZZZZZZZZZZZX' as SID);
                expect(verify(id)).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });

        it('generates exact canonical identifier from fixed byte sequence', () => {
            // payload values 0..14 ('0123456789ABCDE') with high bit variation
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
                expect(id).toBe('0123456789ABCDEN' as SID);
                expect(verify(id)).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });
    });

    describe('Missing Web Crypto Runtime Behavior', () => {
        it('throws TypeError when globalThis.crypto is undefined', () => {
            const originalCrypto = globalThis.crypto;
            try {
                // Temporarily mask crypto
                Object.defineProperty(globalThis, 'crypto', {
                    value: undefined,
                    configurable: true,
                    writable: true,
                });

                expect(() => generate()).toThrow(TypeError);
                expect(() => generateFormatted()).toThrow(TypeError);
            } finally {
                Object.defineProperty(globalThis, 'crypto', {
                    value: originalCrypto,
                    configurable: true,
                    writable: true,
                });
            }
        });
    });
});
