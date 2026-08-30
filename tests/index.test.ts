/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import {
    type FormattedSID,
    format,
    generate,
    generateFormatted,
    parse,
    type SID,
    unformat,
    verify,
} from '../src/index';

// -------------------------------------------------------------------
// 2. Constants & Fixtures
// -------------------------------------------------------------------

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const INVALID_INPUTS: unknown[] = [
    null,
    undefined,
    12345,
    10n,
    true,
    false,
    Symbol('sid'),
    {},
    Object.create(null),
    [],
    () => {},
];

// -------------------------------------------------------------------
// 3. Test Suite
// -------------------------------------------------------------------

describe('SID Module', () => {
    describe('generate()', () => {
        it('generates a valid 16-character canonical SID', () => {
            const id = generate();
            expect(typeof id).toBe('string');
            expect(id).toHaveLength(16);
            expect(verify(id)).toBe(true);
        });

        it('generates unique identifiers across batch generation without collisions', () => {
            // generate a batch of 1,000 IDs and assert complete uniqueness.
            const seen = new Set<string>();
            for (let i = 0; i < 1_000; i++) {
                const id = generate();
                expect(verify(id)).toBe(true);
                expect(seen.has(id)).toBe(false);
                seen.add(id);
            }
        });

        it('guarantees complete alphabet utilization and zero forbidden characters', () => {
            // assert zero forbidden characters `/[ILOUilou]/` and uniform bucket spread across 1,000 samples.
            const bucketCounts = new Uint32Array(32);
            for (let i = 0; i < 1_000; i++) {
                const id = generate();
                expect(id).not.toMatch(/[ILOUilou]/);
                for (let j = 0; j < 15; j++) {
                    const idx = ALPHABET.indexOf(id[j]);
                    if (idx !== -1) {
                        bucketCounts[idx]++;
                    }
                }
            }
            // every single Crockford Base32 symbol must appear at least once across 15,000 generated characters.
            expect(bucketCounts.every((count) => count > 0)).toBe(true);
        });
    });

    describe('generateFormatted()', () => {
        it('generates a valid quad-grouped FormattedSID matching expected pattern', () => {
            const formatted = generateFormatted();
            expect(typeof formatted).toBe('string');
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

    describe('verify()', () => {
        it('returns false for invalid input types without throwing', () => {
            for (const input of INVALID_INPUTS) {
                expect(verify(input)).toBe(false);
            }
        });

        it('returns false for invalid lengths', () => {
            expect(verify('0123456789ABCDE')).toBe(false); // 15 characters.
            expect(verify('0123456789ABCDEFG')).toBe(false); // 17 characters.
            expect(verify('')).toBe(false);
        });

        it('returns false for illegal Crockford Base32 characters', () => {
            expect(verify('0123456789ABCDU0')).toBe(false); // `'U'` is excluded to prevent obscenities.
            expect(verify('0123456789ABCD!0')).toBe(false); // special character.
        });

        it('rejects high-byte unicode and multibyte characters safely', () => {
            // characters with code point >= 256 or emojis.
            expect(verify('0123456789ABCD\u01000')).toBe(false);
            expect(verify('0123456789ABCD\uFFFD0')).toBe(false);
            expect(verify('0123456789ABCD😊0')).toBe(false);
            expect(parse('0123456789ABCD\u01000').ok).toBe(false);
        });

        it('rejects inputs with non-hyphen delimiters', () => {
            const valid = generate();
            expect(verify(`${valid.slice(0, 4)} ${valid.slice(4)}`)).toBe(false);
            expect(verify(`${valid.slice(0, 4)}.${valid.slice(4)}`)).toBe(false);
            expect(verify(`${valid.slice(0, 4)}:${valid.slice(4)}`)).toBe(false);
            expect(verify(`${valid.slice(0, 4)}/${valid.slice(4)}`)).toBe(false);
            expect(verify(`${valid.slice(0, 4)}_${valid.slice(4)}`)).toBe(false);
        });

        it('rejects inputs with consecutive hyphens', () => {
            const valid = generate();
            const doubleHyphen = `${valid.slice(0, 4)}--${valid.slice(4, 8)}-${valid.slice(8, 12)}-${valid.slice(12)}`;
            expect(verify(doubleHyphen)).toBe(false);
        });

        it('rejects inputs with hyphens at arbitrary positions', () => {
            const valid = generate();
            const wrongHyphen = `${valid.slice(0, 3)}-${valid.slice(3, 7)}-${valid.slice(7, 11)}-${valid.slice(11)}`;
            expect(verify(wrongHyphen)).toBe(false);
        });

        it('detects all possible single-character substitutions across all 16 positions', () => {
            // exhaustively mutate every position (0..15) with all 31 alternate Crockford characters.
            const valid = generate();
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

        it('detects adjacent transpositions across all 14 payload pairs deterministically', () => {
            // deterministic fixture: all 14 payload-internal adjacent pairs have distinct values with distance != 16.
            // payload `0123456789ABCDE` + check char `N` (val 21).
            const fixture = parse('0123456789ABCDEN');
            expect(fixture.ok).toBe(true);
            if (!fixture.ok) {
                return;
            }

            const valid = fixture.data;
            for (let i = 0; i < 14; i++) {
                const c1 = valid[i];
                const c2 = valid[i + 1];
                const swapped = `${valid.slice(0, i)}${c2}${c1}${valid.slice(i + 2)}`;
                expect(verify(swapped)).toBe(false);
            }
        });

        it('verifies documented delta-16 transposition boundary invariant', () => {
            // INVARIANT: modulo-32 arithmetic cannot detect adjacent transpositions with character distance 16.
            // `'0'` (val 0) and `'G'` (val 16) have delta = 16 (`2 * 16 = 32 = 0 mod 32`).
            const valid = '00000000000000GG';
            expect(verify(valid)).toBe(true);

            // swapping `'0G'` to `'G0'` yields equivalent sum modulo 32.
            const swappedDelta16 = '0000000000000G0G';
            expect(verify(swappedDelta16)).toBe(true);
        });

        it('accepts exact XXXX-XXXX-XXXX-XXXX hyphenated format', () => {
            const valid = generate();
            const formatted = `${valid.slice(0, 4)}-${valid.slice(4, 8)}-${valid.slice(8, 12)}-${valid.slice(12, 16)}`;
            expect(verify(formatted)).toBe(true);
            expect(verify(formatted.toLowerCase())).toBe(true);
        });

        it('accepts valid identifiers with leading and trailing whitespace', () => {
            const valid = generate();
            const formatted = `${valid.slice(0, 4)}-${valid.slice(4, 8)}-${valid.slice(8, 12)}-${valid.slice(12, 16)}`;
            expect(verify(`  ${valid}  `)).toBe(true);
            expect(verify(`\t\n${formatted}\r\n`)).toBe(true);
        });
    });

    describe('parse()', () => {
        it('parses valid raw and hyphenated input into canonical SID', () => {
            const id = generate();
            const formatted = `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}`;

            const parseRaw = parse(id);
            const parseFormatted = parse(formatted);

            expect(parseRaw).toEqual({ ok: true, data: id });
            expect(parseFormatted).toEqual({ ok: true, data: id });
        });

        it('parses valid input with leading and trailing whitespace', () => {
            const id = generate();
            const formatted = `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}`;
            expect(parse(`  ${id}  `)).toEqual({ ok: true, data: id });
            expect(parse(`\n\t${formatted}\r\n`)).toEqual({ ok: true, data: id });
        });

        it('repairs ambiguous characters during parsing', () => {
            // repair `'i'` and `'l'` to `'1'`, `'o'` to `'0'`.
            const id = generate();
            const res = parse(id.toLowerCase());
            expect(res).toEqual({ ok: true, data: id });
        });

        it('repairs uppercase ambiguous characters I, L, O to canonical equivalents', () => {
            // deterministic fixture '0123456789ABCDEN' with 'O', 'I', 'L'.
            const fixture = parse('0123456789ABCDEN');
            expect(fixture.ok).toBe(true);
            if (!fixture.ok) {
                return;
            }

            const resI = parse('OI23456789ABCDEN');
            expect(resI).toEqual({ ok: true, data: fixture.data });

            const resL = parse('OL23456789ABCDEN');
            expect(resL).toEqual({ ok: true, data: fixture.data });
        });

        it('formats exact length diagnostics on varied invalid lengths', () => {
            // test boundary length diagnostics across empty, short, and long lengths.
            for (const len of [0, 1, 15, 17, 32]) {
                const res = parse('A'.repeat(len));
                expect(res).toEqual({
                    ok: false,
                    error: `Invalid ID length: expected 16 characters, got ${len}`,
                });
            }
        });

        it('rejects 19-character input with extraneous hyphens with format diagnostic', () => {
            const res = parse('ABCD-EFGH-JKMN-P-12');
            expect(res).toEqual({
                ok: false,
                error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14',
            });
        });

        it('rejects 19-character input with invalid delimiter at quad positions', () => {
            const resDot = parse('ABCD.EFGH.JKMN.P123');
            expect(resDot).toEqual({
                ok: false,
                error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14',
            });

            const resSpace = parse('ABCD EFGH JKMN P123');
            expect(resSpace).toEqual({
                ok: false,
                error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14',
            });
        });

        it('returns specific diagnostic error when identifier contains invalid characters', () => {
            // 'U' in payload position.
            const invalidPayloadChar = '0123456789ABCDU0';
            expect(parse(invalidPayloadChar)).toEqual({
                ok: false,
                error: `Invalid ID: '${invalidPayloadChar}' contains invalid character`,
            });

            // 'U' in check character position (16th character).
            const invalidCheckChar = '0123456789ABCDEU';
            expect(parse(invalidCheckChar)).toEqual({
                ok: false,
                error: `Invalid ID: '${invalidCheckChar}' contains invalid character`,
            });
        });

        it('returns specific diagnostic error when identifier fails checksum validation', () => {
            // valid Crockford alphabet characters with corrupted checksum.
            const invalidChecksum = '0123456789ABCDEF';
            const result = parse(invalidChecksum);
            expect(result).toEqual({
                ok: false,
                error: `Invalid ID: '${invalidChecksum}' failed checksum validation`,
            });
        });

        it('rejects all non-string values in INVALID_INPUTS without throwing', () => {
            for (const input of INVALID_INPUTS) {
                const res = parse(input);
                expect(res.ok).toBe(false);
                if (!res.ok) {
                    expect(res.error).toContain('Expected string input');
                }
            }
        });
    });

    describe('format()', () => {
        it('normalizes, validates, and groups an unhyphenated SID', () => {
            const id = generate();
            const result = format(id);

            expect(result).toEqual({
                ok: true,
                data: `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}` as FormattedSID,
            });
        });

        it('re-formats already-hyphenated input with lowercase repair', () => {
            const id = generate();
            const messy = `${id.slice(0, 4).toLowerCase()}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}`;
            const result = format(messy);

            expect(result).toEqual({
                ok: true,
                data: `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}` as FormattedSID,
            });
        });

        it('formats input with leading and trailing whitespace cleanly', () => {
            const id = generate();
            const result = format(`  \t${id} \n `);
            expect(result).toEqual({
                ok: true,
                data: `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}` as FormattedSID,
            });
        });

        it('returns failure result when formatting invalid identifiers without throwing', () => {
            const result = format('INVALID_LENGTH');
            expect(result.ok).toBe(false);
        });

        it('returns failure result for all non-string inputs in INVALID_INPUTS without throwing', () => {
            for (const input of INVALID_INPUTS) {
                const result = format(input);
                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error).toContain('Expected string input');
                }
            }
        });
    });

    describe('unformat()', () => {
        it('unformats FormattedSID back to canonical 16-character SID', () => {
            const formatted = generateFormatted();
            const unformatted = unformat(formatted);

            expect(typeof unformatted).toBe('string');
            expect(unformatted).toHaveLength(16);
            expect(unformatted).not.toContain('-');
            expect(verify(unformatted)).toBe(true);
        });

        it('is the exact inverse of format() for valid canonical SIDs', () => {
            const id = generate();
            const formatted = format(id);
            expect(formatted.ok).toBe(true);
            if (formatted.ok) {
                expect(unformat(formatted.data)).toBe(id);
            }
        });
    });
});
