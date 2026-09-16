/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, parse, verify } from '../src/index';
import { quad, VALID_ID } from './helpers';

// -------------------------------------------------------------------
// 2. Test Suite: parse() & Unicode Normalization
// -------------------------------------------------------------------

describe('parse() - Unicode Safety & Case Mapping', () => {
    it('rejects Unicode characters whose case mapping would produce a valid ID', () => {
        // Each input would become its valid ASCII equivalent under v0.1.0's toUpperCase() normalization,
        // so these fixtures fail loudly if case mapping is ever reintroduced.
        const lookalikes = [
            // German eszett 'ß' expands to 'SS' (15 -> 16 characters)
            { input: 'W0000000000000ß', ascii: 'W0000000000000SS', code: 'INVALID_LENGTH' },
            // Latin small ligature fi 'ﬁ' (U+FB01) expands to 'FI', and 'I' repairs to '1'
            { input: 'E0000000000000ﬁ', ascii: 'E0000000000000F1', code: 'INVALID_LENGTH' },
            // Turkish dotless i 'ı' (U+0131) uppercases to 'I', which repairs to '1'
            { input: '0ı23456789ABCDE7', ascii: '0123456789ABCDE7', code: 'INVALID_CHARACTER' },
            // Latin small letter long s 'ſ' (U+017F) uppercases to 'S'
            { input: '0123456789ABCDſE', ascii: '0123456789ABCDSE', code: 'INVALID_CHARACTER' },
        ] as const;

        for (const { input, ascii, code } of lookalikes) {
            expect(verify(ascii)).toBe(true);
            expect(verify(input)).toBe(false);
            const res = parse(input);
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect(res.code).toBe(code);
            }
        }

        // Latin-1 supplement character 'Ä' (U+00C4) has no ASCII mapping and fails the character check
        expect(parse('0123456789ABCDÄ7')).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: "Invalid ID: '0123456789ABCDÄ7' contains invalid character",
        });
    });

    it('rejects multibyte emoji with exact 16 UTF-16 code units via character check', () => {
        // '0123456789ABC' (13) + '😊' (2) + '0' (1) = exactly 16 UTF-16 code units
        const emoji16 = '0123456789ABC😊0';
        expect(emoji16.length).toBe(16);
        expect(verify(emoji16)).toBe(false);

        const result = parse(emoji16);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toBe(`Invalid ID: '${emoji16}' contains invalid character`);
        }
    });

    it('repairs uppercase I, L, O to canonical equivalents in raw and formatted input', () => {
        expect(parse('OI23456789ABCDE7')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('OL23456789ABCDE7')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('OI23-4567-89AB-CDE7')).toEqual({ ok: true, data: VALID_ID });
        expect(verify('OL23-4567-89AB-CDE7')).toBe(true);
    });

    it('repairs lowercase i, l, o inside formatted strings', () => {
        // 'oi23-4567-89ab-cde7' has lowercase 'o' -> '0', 'i' -> '1', 'a'->'A', 'b'->'B', 'c'->'C', 'd'->'D', 'e'->'E'
        const messyFormatted = 'oi23-4567-89ab-cde7';
        const parsed = parse(messyFormatted);
        expect(parsed).toEqual({
            ok: true,
            data: VALID_ID,
        });
        expect(verify(messyFormatted)).toBe(true);

        // Lowercase 'l' -> '1' repair inside formatted string
        const messyWithL = 'ol23-4567-89ab-cde7';
        const parsedWithL = parse(messyWithL);
        expect(parsedWithL).toEqual({
            ok: true,
            data: VALID_ID,
        });
        expect(verify(messyWithL)).toBe(true);
    });
});

describe('parse() - Unusual Non-String Inputs', () => {
    it('rejects null with explicit received null message', () => {
        expect(verify(null)).toBe(false);
        const res = parse(null);
        expect(res).toEqual({
            ok: false,
            code: 'NOT_A_STRING',
            error: 'Expected string input, received null',
        });
    });

    it('reports boxed strings and non-finite numbers as NOT_A_STRING', () => {
        // boxed String objects have typeof === 'object' and must be rejected
        const boxed = new String(VALID_ID);
        expect(verify(boxed)).toBe(false);
        const parseBoxed = parse(boxed);
        expect(parseBoxed.ok).toBe(false);
        if (!parseBoxed.ok) {
            expect(parseBoxed.code).toBe('NOT_A_STRING');
            expect(parseBoxed.error).toBe('Expected string input, received object');
        }

        // NaN, Infinity, -Infinity
        for (const num of [NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            expect(verify(num)).toBe(false);
            const res = parse(num);
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect(res.code).toBe('NOT_A_STRING');
                expect(res.error).toBe('Expected string input, received number');
            }
        }
    });
});

describe('parse() - Structural & Boundary Edge Cases', () => {
    it('rejects 16-character input containing misplaced hyphens with invalid character error', () => {
        const hyphenated16 = '0123-456789ABCDE';
        expect(hyphenated16.length).toBe(16);
        expect(verify(hyphenated16)).toBe(false);

        const res = parse(hyphenated16);
        expect(res).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: `Invalid ID: '${hyphenated16}' contains invalid character`,
        });
    });

    it('rejects boundary lengths around 19 and whitespace-only strings', () => {
        // Lengths 15 and 17 (neighbours of the raw length 16)
        expect(parse('0123456789ABCDE')).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 16 (raw) or 19 (XXXX-XXXX-XXXX-XXXX) characters, got 15',
        });
        expect(parse('0123456789ABCDE70')).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 16 (raw) or 19 (XXXX-XXXX-XXXX-XXXX) characters, got 17',
        });

        // Length 18
        const len18 = '0123456789ABCDEF01';
        expect(len18.length).toBe(18);
        expect(verify(len18)).toBe(false);
        expect(parse(len18)).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 16 (raw) or 19 (XXXX-XXXX-XXXX-XXXX) characters, got 18',
        });

        // Length 20
        const len20 = '0123-4567-89AB-CDE70';
        expect(len20.length).toBe(20);
        expect(verify(len20)).toBe(false);
        expect(parse(len20)).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 16 (raw) or 19 (XXXX-XXXX-XXXX-XXXX) characters, got 20',
        });

        // Whitespace-only string trims to empty string (length 0)
        expect(verify('   ')).toBe(false);
        expect(parse('   ')).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 16 (raw) or 19 (XXXX-XXXX-XXXX-XXXX) characters, got 0',
        });

        // Verifies length is measured AFTER trimming
        const raw18 = `  ${VALID_ID}`;
        expect(raw18.length).toBe(18);
        expect(verify(raw18)).toBe(true);
        expect(parse(raw18)).toEqual({
            ok: true,
            data: VALID_ID,
        });
    });

    it('returns character and checksum errors for 19-char formatted inputs with valid hyphens', () => {
        // Valid hyphen placement but invalid Crockford Base32 character 'U'
        const invalidCharFormatted = '0123-4567-89AB-CDEU';
        expect(verify(invalidCharFormatted)).toBe(false);
        expect(parse(invalidCharFormatted)).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: "Invalid ID: '0123456789ABCDEU' contains invalid character",
        });

        // Valid hyphen placement and valid alphabet, but invalid checksum
        const invalidChecksumFormatted = '0123-4567-89AB-CDEF';
        expect(verify(invalidChecksumFormatted)).toBe(false);
        expect(parse(invalidChecksumFormatted)).toEqual({
            ok: false,
            code: 'CHECKSUM_MISMATCH',
            error: "Invalid ID: '0123456789ABCDEF' failed checksum validation",
        });
    });

    it('triggers every hyphen failure branch for 19-character inputs', () => {
        const expectedFormatError = {
            ok: false,
            code: 'INVALID_FORMAT',
            error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14 (0-based)',
        } as const;

        // Missing hyphen at index 4
        const missingHyphen4 = '012345678-89AB-CDE7';
        expect(verify(missingHyphen4)).toBe(false);
        expect(parse(missingHyphen4)).toEqual(expectedFormatError);

        // Missing hyphen at index 9
        const missingHyphen9 = '0123-4567889AB-CDE7';
        expect(verify(missingHyphen9)).toBe(false);
        expect(parse(missingHyphen9)).toEqual(expectedFormatError);

        // Missing hyphen at index 14
        const missingHyphen14 = '0123-4567-89ABCCDE7';
        expect(verify(missingHyphen14)).toBe(false);
        expect(parse(missingHyphen14)).toEqual(expectedFormatError);

        // Extra hyphen before position 4 (e.g. index 0)
        const hyphenAt0 = '-123-4567-89AB-CDE7';
        expect(verify(hyphenAt0)).toBe(false);
        expect(parse(hyphenAt0)).toEqual(expectedFormatError);

        // Extra hyphen between groups (e.g. index 5)
        const doubleHyphen5 = '0123--567-89AB-CDE7';
        expect(verify(doubleHyphen5)).toBe(false);
        expect(parse(doubleHyphen5)).toEqual(expectedFormatError);

        // Extra hyphen after position 15 (e.g. index 18)
        const trailingHyphen = '0123-4567-89AB-CDE-';
        expect(verify(trailingHyphen)).toBe(false);
        expect(parse(trailingHyphen)).toEqual(expectedFormatError);
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
        for (const badInput of [
            'INVALID_LENGTH',
            '0123456789ABCDU0',
            '0123.4567.89AB.CDE7',
            '0123456789ABCDEF',
            null,
            undefined,
            12345,
            true,
            {},
        ]) {
            const parseRes = parse(badInput);
            expect(parseRes.ok).toBe(false);
            // identical failure result, including the error code
            expect<unknown>(format(badInput)).toEqual(parseRes);
        }
    });
});
