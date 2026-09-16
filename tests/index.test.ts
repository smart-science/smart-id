/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import {
    format,
    generate,
    generateFormatted,
    parse,
    type FormattedSID,
    type SID,
    unformat,
    verify,
} from '../src/index';
import { mustParse, quad, VALID_FORMATTED, VALID_ID, VALID_ID_2 } from './helpers';

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
            expect(id).toHaveLength(16);
            expect(verify(id)).toBe(true);
        });

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
    });

    describe('generateFormatted()', () => {
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

    describe('verify()', () => {
        it('returns false for invalid input types without throwing', () => {
            for (const input of INVALID_INPUTS) {
                expect(verify(input)).toBe(false);
            }
        });

        it('rejects high-byte unicode and multibyte characters safely', () => {
            expect(verify('0123456789ABCD\u01000')).toBe(false);
            expect(verify('0123456789ABCD\uFFFD0')).toBe(false);
            expect(verify('0123456789ABCD😊0')).toBe(false);
            expect(parse('0123456789ABCD\u01000').ok).toBe(false);
        });

        it('rejects 19-character inputs with non-hyphen delimiters', () => {
            // F-42: use exact 19 characters to test delimiter logic rather than length logic.
            const p = VALID_ID;
            expect(verify(`${p.slice(0, 4)} ${p.slice(4, 8)} ${p.slice(8, 12)} ${p.slice(12, 16)}`)).toBe(false);
            expect(verify(`${p.slice(0, 4)}.${p.slice(4, 8)}.${p.slice(8, 12)}.${p.slice(12, 16)}`)).toBe(false);
            expect(verify(`${p.slice(0, 4)}:${p.slice(4, 8)}:${p.slice(8, 12)}:${p.slice(12, 16)}`)).toBe(false);
            expect(verify(`${p.slice(0, 4)}/${p.slice(4, 8)}/${p.slice(8, 12)}/${p.slice(12, 16)}`)).toBe(false);
            expect(verify(`${p.slice(0, 4)}_${p.slice(4, 8)}_${p.slice(8, 12)}_${p.slice(12, 16)}`)).toBe(false);
        });

        it('rejects 19-character inputs with consecutive hyphens', () => {
            // F-43: exactly 19 characters with consecutive hyphens
            expect(verify('0123--567-89AB-CDEN')).toBe(false);
        });

        it('rejects inputs with hyphens at arbitrary positions', () => {
            const p = VALID_ID;
            const wrongHyphen = `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7, 11)}-${p.slice(11)}`;
            expect(verify(wrongHyphen)).toBe(false);
        });

        it('detects all possible single-character substitutions across all 16 positions', () => {
            // F-66: deterministic fixed valid ID
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

        it('detects adjacent transpositions across all 14 payload pairs deterministically', () => {
            // F-67: use mustParse helper
            const valid = mustParse(VALID_ID);
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
            // F-67: use quad helper
            const formatted = quad(VALID_ID);
            expect(verify(formatted)).toBe(true);
            expect(verify(formatted.toLowerCase())).toBe(true);
        });

        it('accepts valid identifiers with leading and trailing whitespace', () => {
            const formatted = quad(VALID_ID);
            expect(verify(`  ${VALID_ID}  `)).toBe(true);
            expect(verify(`\t\n${formatted}\r\n`)).toBe(true);
        });
    });

    describe('parse()', () => {
        it('parses valid raw and hyphenated input into canonical SID', () => {
            // F-66 / F-67: fixed ID and quad helper
            const id = VALID_ID;
            const formatted = quad(id);

            const parseRaw = parse(id);
            const parseFormatted = parse(formatted);

            expect(parseRaw).toEqual({ ok: true, data: id });
            expect(parseFormatted).toEqual({ ok: true, data: id });
        });

        it('parses valid input with leading and trailing whitespace', () => {
            const id = VALID_ID;
            const formatted = quad(id);
            expect(parse(`  ${id}  `)).toEqual({ ok: true, data: id });
            expect(parse(`\n\t${formatted}\r\n`)).toEqual({ ok: true, data: id });
        });

        it('normalizes lowercase input', () => {
            // F-45: renamed test (lowercase normalizes to canonical uppercase)
            const id = VALID_ID;
            const res = parse(id.toLowerCase());
            expect(res).toEqual({ ok: true, data: id });
        });

        it('repairs uppercase ambiguous characters I, L, O to canonical equivalents', () => {
            // F-67: deterministic fixture using mustParse
            const valid = mustParse(VALID_ID);

            const resI = parse('OI23456789ABCDEN');
            expect(resI).toEqual({ ok: true, data: valid });

            const resL = parse('OL23456789ABCDEN');
            expect(resL).toEqual({ ok: true, data: valid });
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
            const id = VALID_ID;
            const result = format(id);

            expect(result).toEqual({
                ok: true,
                data: quad(id),
            });
        });

        it('re-formats already-hyphenated input with lowercase repair', () => {
            const id = VALID_ID;
            const messy = `${id.slice(0, 4).toLowerCase()}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}`;
            const result = format(messy);

            expect(result).toEqual({
                ok: true,
                data: quad(id),
            });
        });

        it('formats input with leading and trailing whitespace cleanly', () => {
            const id = VALID_ID;
            const result = format(`  \t${id} \n `);
            expect(result).toEqual({
                ok: true,
                data: quad(id),
            });
        });

        it('delegates validation failures to parse without throwing', () => {
            // F-48: delegation check instead of trivial format failure
            for (const badInput of ['INVALID_LENGTH', '0123456789ABCDU0', ...INVALID_INPUTS]) {
                const parseRes = parse(badInput);
                const formatRes = format(badInput);
                expect(formatRes.ok).toBe(false);
                if (!formatRes.ok && !parseRes.ok) {
                    expect(formatRes.error).toBe(parseRes.error);
                }
            }
        });
    });

    describe('unformat()', () => {
        it('unformats FormattedSID back to canonical 16-character SID', () => {
            const formatted = VALID_FORMATTED;
            const unformatted = unformat(formatted);

            expect(unformatted).toHaveLength(16);
            expect(unformatted).not.toContain('-');
            expect(verify(unformatted)).toBe(true);
        });

        it('is the exact inverse of format() for valid canonical SIDs', () => {
            const id = VALID_ID;
            const formatted = format(id);
            expect(formatted.ok).toBe(true);
            if (formatted.ok) {
                expect(unformat(formatted.data)).toBe(id);
            }
        });
    });
});
