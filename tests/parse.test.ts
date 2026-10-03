// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, parse, verify } from '../src/index.js';
import { quad, VALID_ID } from './helpers.js';

// -------------------------------------------------------------------
// 2. Test Suite: parse() & Unicode Normalization
// -------------------------------------------------------------------

describe('parse() - Unicode Safety & Case Mapping', () => {
    it('rejects Unicode characters whose case mapping would produce a valid ID', () => {
        // Each input would become its valid ASCII equivalent under v0.1.0's toUpperCase() normalization,
        // so these fixtures fail loudly if case mapping is ever reintroduced.
        const lookalikes = [
            // German eszett 'ß' expands to 'SS' (19 -> 20 characters)
            { input: 'W000000000000000ZFß', ascii: 'W000000000000000ZFSS', code: 'INVALID_LENGTH' },
            // Latin small ligature fi 'ﬁ' (U+FB01) expands to 'FI', and 'I' repairs to '1'
            { input: 'E0000000000000001Sﬁ', ascii: 'E0000000000000001SF1', code: 'INVALID_LENGTH' },
            // Turkish dotless i 'ı' (U+0131) uppercases to 'I', which repairs to '1'
            { input: '0ı23456789ABCDEFGHWJ', ascii: '0123456789ABCDEFGHWJ', code: 'INVALID_CHARACTER' },
            // Latin small letter long s 'ſ' (U+017F) uppercases to 'S'
            { input: '0123456789ABCDEFGſ12', ascii: '0123456789ABCDEFGS12', code: 'INVALID_CHARACTER' },
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
        expect(parse('0123456789ABCDEFGHÄJ')).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: 'Invalid ID "0123456789ABCDEFGHÄJ" contains invalid character "Ä" at index 18',
        });
    });

    it('rejects multibyte emoji with exact 20 UTF-16 code units via character check', () => {
        // '0123456789ABCDEFG' (17) + '😊' (2) + '0' (1) = exactly 20 UTF-16 code units
        const emoji20 = '0123456789ABCDEFG😊0';
        expect(emoji20.length).toBe(20);
        expect(verify(emoji20)).toBe(false);

        const result = parse(emoji20);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toBe(`Invalid ID "${emoji20}" contains invalid character "😊" at index 17`);
        }
    });

    it('repairs uppercase I, L, O to canonical equivalents in raw and formatted input', () => {
        expect(parse('OI23456789ABCDEFGHWJ')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('OL23456789ABCDEFGHWJ')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('OI23-4567-89AB-CDEF-GHWJ')).toEqual({ ok: true, data: VALID_ID });
        expect(verify('OL23-4567-89AB-CDEF-GHWJ')).toBe(true);
    });

    it('repairs lowercase i, l, o in raw and formatted input', () => {
        expect(parse('oi23456789abcdefghwj')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('ol23456789abcdefghwj')).toEqual({ ok: true, data: VALID_ID });

        // 'oi23-4567-89ab-cdef-ghwj' has lowercase 'o' -> '0', 'i' -> '1', and the remaining letters uppercased
        const messyFormatted = 'oi23-4567-89ab-cdef-ghwj';
        const parsed = parse(messyFormatted);
        expect(parsed).toEqual({
            ok: true,
            data: VALID_ID,
        });
        expect(verify(messyFormatted)).toBe(true);

        // Lowercase 'l' -> '1' repair inside formatted string
        const messyWithL = 'ol23-4567-89ab-cdef-ghwj';
        const parsedWithL = parse(messyWithL);
        expect(parsedWithL).toEqual({
            ok: true,
            data: VALID_ID,
        });
        expect(verify(messyWithL)).toBe(true);
    });

    it('repairs ambiguous characters in the check positions', () => {
        expect(parse('000000000000000000OO')).toEqual({ ok: true, data: '00000000000000000000' });
        expect(parse('000000000000000000oo')).toEqual({ ok: true, data: '00000000000000000000' });
    });
});

describe('parse() - Structural & Boundary Edge Cases', () => {
    it('rejects 20-character input containing misplaced hyphens with invalid character error', () => {
        const hyphenated20 = '0123-456789ABCDEFGHW';
        expect(hyphenated20.length).toBe(20);
        expect(verify(hyphenated20)).toBe(false);

        const res = parse(hyphenated20);
        expect(res).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: 'Invalid ID "0123-456789ABCDEFGHW" contains invalid character "-" at index 4',
        });
    });

    it('rejects boundary lengths around 20 and 24 and whitespace-only strings', () => {
        // Lengths 19 and 21 (neighbours of the raw length 20)
        expect(parse('0123456789ABCDEFGHW')).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 19',
        });
        expect(parse('0123456789ABCDEFGHWJ0')).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 21',
        });

        // Length 22
        const len22 = '0123456789ABCDEFGHWJ01';
        expect(verify(len22)).toBe(false);
        expect(parse(len22)).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 22',
        });

        // Lengths 23 and 25 (neighbours of the formatted length 24)
        const len23 = '0123-4567-89AB-CDEF-GHW';
        expect(verify(len23)).toBe(false);
        expect(parse(len23)).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 23',
        });
        const len25 = '0123-4567-89AB-CDEF-GHWJ0';
        expect(verify(len25)).toBe(false);
        expect(parse(len25)).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 25',
        });

        // Whitespace-only string trims to empty string (length 0)
        expect(verify('   ')).toBe(false);
        expect(parse('   ')).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 0',
        });

        // Zero-width space is not whitespace, so it is not trimmed
        expect(parse(`​${VALID_ID}`)).toEqual({
            ok: false,
            code: 'INVALID_LENGTH',
            error: 'Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got 21',
        });

        // Verifies length is measured AFTER trimming
        const raw22 = `  ${VALID_ID}`;
        expect(verify(raw22)).toBe(true);
        expect(parse(raw22)).toEqual({
            ok: true,
            data: VALID_ID,
        });
    });

    it('reports the invalid character and its index in the trimmed input for every position', () => {
        for (let p = 0; p < 20; p++) {
            const raw = `${VALID_ID.slice(0, p)}U${VALID_ID.slice(p + 1)}`;
            const formatted = quad(raw);
            const formattedIndex = p + Math.floor(p / 4);
            expect(formatted[formattedIndex]).toBe('U'); // guards the expectation itself

            for (const [input, trimmed, index] of [
                [raw, raw, p],
                [formatted, formatted, formattedIndex],
                [` \t${formatted}\n`, formatted, formattedIndex], // index refers to the trimmed input
            ] as const) {
                expect(parse(input)).toEqual({
                    ok: false,
                    code: 'INVALID_CHARACTER',
                    error: `Invalid ID ${JSON.stringify(trimmed)} contains invalid character "U" at index ${index}`,
                });
            }
        }
    });

    it('escapes quotes and control characters in the reported character', () => {
        expect(parse("0123456789ABC'EFGHWJ")).toMatchObject({
            error: expect.stringContaining(`character "'" at index 13`),
        });
        expect(parse('0123456789ABC\nEFGHWJ')).toMatchObject({
            error: expect.stringContaining('character "\\n" at index 13'),
        });
    });

    it('reports the first invalid character when multiple are present', () => {
        expect(parse('U123456789ABCDEFGHWU')).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: 'Invalid ID "U123456789ABCDEFGHWU" contains invalid character "U" at index 0',
        });
    });

    it('rejects lowercase u, which is not repaired', () => {
        expect(parse('0123456789abcdefghuj')).toEqual({
            ok: false,
            code: 'INVALID_CHARACTER',
            error: 'Invalid ID "0123456789abcdefghuj" contains invalid character "u" at index 18',
        });
    });

    it('returns a checksum error for 24-character formatted input with valid hyphens', () => {
        // Valid hyphen placement and valid alphabet, but invalid checksum
        const invalidChecksumFormatted = '0123-4567-89AB-CDEF-GHWK';
        expect(verify(invalidChecksumFormatted)).toBe(false);
        expect(parse(invalidChecksumFormatted)).toEqual({
            ok: false,
            code: 'CHECKSUM_MISMATCH',
            error: 'Invalid ID "0123-4567-89AB-CDEF-GHWK" failed checksum validation',
        });
    });

    it('triggers every hyphen failure branch for 24-character inputs', () => {
        const expectedFormatError = {
            ok: false,
            code: 'INVALID_FORMAT',
            error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14, 19 (0-based)',
        } as const;

        // Missing hyphen at index 4
        const missingHyphen4 = '012345678-89AB-CDEF-GHWJ';
        expect(verify(missingHyphen4)).toBe(false);
        expect(parse(missingHyphen4)).toEqual(expectedFormatError);

        // Missing hyphen at index 9
        const missingHyphen9 = '0123-4567889AB-CDEF-GHWJ';
        expect(verify(missingHyphen9)).toBe(false);
        expect(parse(missingHyphen9)).toEqual(expectedFormatError);

        // Missing hyphen at index 14
        const missingHyphen14 = '0123-4567-89ABCCDEF-GHWJ';
        expect(verify(missingHyphen14)).toBe(false);
        expect(parse(missingHyphen14)).toEqual(expectedFormatError);

        // Missing hyphen at index 19
        const missingHyphen19 = '0123-4567-89AB-CDEFFGHWJ';
        expect(verify(missingHyphen19)).toBe(false);
        expect(parse(missingHyphen19)).toEqual(expectedFormatError);

        // Extra hyphen before position 4 (e.g. index 0)
        const hyphenAt0 = '-123-4567-89AB-CDEF-GHWJ';
        expect(verify(hyphenAt0)).toBe(false);
        expect(parse(hyphenAt0)).toEqual(expectedFormatError);

        // Extra hyphen between groups (e.g. index 5)
        const doubleHyphen5 = '0123--567-89AB-CDEF-GHWJ';
        expect(verify(doubleHyphen5)).toBe(false);
        expect(parse(doubleHyphen5)).toEqual(expectedFormatError);

        // Extra hyphen after position 20 (e.g. index 23)
        const trailingHyphen = '0123-4567-89AB-CDEF-GHW-';
        expect(verify(trailingHyphen)).toBe(false);
        expect(parse(trailingHyphen)).toEqual(expectedFormatError);

        // Other delimiters at the hyphen positions
        for (const delimited of [
            '0123.4567.89AB.CDEF.GHWJ',
            '0123 4567 89AB CDEF GHWJ',
            '0123_4567_89AB_CDEF_GHWJ',
        ]) {
            expect(verify(delimited)).toBe(false);
            expect(parse(delimited)).toEqual(expectedFormatError);
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
        const messy = `${id.slice(0, 4).toLowerCase()}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}`;
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
            '0123456789ABCDEFGHU0',
            '0123.4567.89AB.CDEF.GHWJ',
            '0123456789ABCDEFGHWK',
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
