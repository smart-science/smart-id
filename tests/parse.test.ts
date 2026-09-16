/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { format, parse, unformat, verify } from '../src/index';
import { quad, VALID_FORMATTED, VALID_ID } from './helpers';

// -------------------------------------------------------------------
// 2. Test Suite: parse() & Unicode Normalization
// -------------------------------------------------------------------

describe('parse() - Unicode Safety & Case Mapping', () => {
    it('rejects Unicode case-mapping characters that uppercase to ASCII letters', () => {
        // German eszett 'ß' previously expanded to 'SS' via toUpperCase() in v0.1.0, letting a 15-char string pass
        expect(verify('E0000000000000ß')).toBe(false);
        const parseEszett15 = parse('E0000000000000ß');
        expect(parseEszett15.ok).toBe(false);
        if (!parseEszett15.ok) {
            expect(parseEszett15.error).toContain('Invalid ID length');
        }

        // 16-character string with 'ß' reaches character check and is rejected
        expect(verify('0123456789ABCDßN')).toBe(false);
        const parseEszett16 = parse('0123456789ABCDßN');
        expect(parseEszett16.ok).toBe(false);
        if (!parseEszett16.ok) {
            expect(parseEszett16.error).toContain('contains invalid character');
        }

        // Turkish dotless i 'ı' (U+0131) uppercases to 'I' which previously repaired to '1'
        expect(verify('0ı23456789ABCDEN')).toBe(false);
        const parseDotlessI = parse('0ı23456789ABCDEN');
        expect(parseDotlessI.ok).toBe(false);
        if (!parseDotlessI.ok) {
            expect(parseDotlessI.error).toContain('contains invalid character');
        }

        // Latin small letter long s 'ſ' (U+017F) uppercases to 'S'
        expect(verify('0123456789ABCDſN')).toBe(false);
        const parseLongS = parse('0123456789ABCDſN');
        expect(parseLongS.ok).toBe(false);
        if (!parseLongS.ok) {
            expect(parseLongS.error).toContain('contains invalid character');
        }

        // Latin small ligature fi 'ﬁ' (U+FB01) uppercases to 'FI'
        expect(verify('0123456789ABCﬁN')).toBe(false);
        const parseLigatureFi = parse('0123456789ABCﬁN');
        expect(parseLigatureFi.ok).toBe(false);

        // Latin-1 supplement character 'Ä' (U+00C4)
        expect(verify('0123456789ABCDÄN')).toBe(false);
        const parseUmlaut = parse('0123456789ABCDÄN');
        expect(parseUmlaut.ok).toBe(false);
        if (!parseUmlaut.ok) {
            expect(parseUmlaut.error).toContain('contains invalid character');
        }
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
        expect(parse('OI23456789ABCDEN')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('OL23456789ABCDEN')).toEqual({ ok: true, data: VALID_ID });
        expect(parse('OI23-4567-89AB-CDEN')).toEqual({ ok: true, data: VALID_ID });
        expect(verify('OL23-4567-89AB-CDEN')).toBe(true);
    });

    it('repairs lowercase i, l, o inside formatted strings', () => {
        // 'oi23-4567-89ab-cden' has lowercase 'o' -> '0', 'i' -> '1', 'a'->'A', 'b'->'B', 'c'->'C', 'd'->'D', 'e'->'E'
        const messyFormatted = 'oi23-4567-89ab-cden';
        const parsed = parse(messyFormatted);
        expect(parsed).toEqual({
            ok: true,
            data: VALID_ID,
        });
        expect(verify(messyFormatted)).toBe(true);

        // Lowercase 'l' -> '1' repair inside formatted string
        const messyWithL = 'ol23-4567-89ab-cden';
        const parsedWithL = parse(messyWithL);
        expect(parsedWithL).toEqual({
            ok: true,
            data: VALID_ID,
        });
        expect(verify(messyWithL)).toBe(true);
    });
});

describe('parse() - Unusual Non-String Inputs', () => {
    it('rejects boxed String instances and unusual non-string objects', () => {
        // boxed String objects have typeof === 'object' and must be rejected
        const boxed = new String(VALID_ID);
        expect(verify(boxed)).toBe(false);
        const parseBoxed = parse(boxed);
        expect(parseBoxed.ok).toBe(false);
        if (!parseBoxed.ok) {
            expect(parseBoxed.error).toContain('Expected string input');
        }

        // Proxy and revoked Proxy
        const proxy = new Proxy({}, {});
        expect(verify(proxy)).toBe(false);
        expect(parse(proxy).ok).toBe(false);

        const revocable = Proxy.revocable({}, {});
        revocable.revoke();
        expect(verify(revocable.proxy)).toBe(false);
        expect(parse(revocable.proxy).ok).toBe(false);

        // NaN, Infinity, -Infinity
        for (const num of [NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            expect(verify(num)).toBe(false);
            const res = parse(num);
            expect(res.ok).toBe(false);
            if (!res.ok) {
                expect(res.error).toContain('Expected string input');
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
            error: `Invalid ID: '${hyphenated16}' contains invalid character`,
        });
    });

    it('rejects boundary lengths around 19 and whitespace-only strings', () => {
        // Lengths 15 and 17 (neighbours of the raw length 16)
        expect(parse('0123456789ABCDE')).toEqual({
            ok: false,
            error: 'Invalid ID length: expected 16 characters, got 15',
        });
        expect(parse('0123456789ABCDEN0')).toEqual({
            ok: false,
            error: 'Invalid ID length: expected 16 characters, got 17',
        });

        // Length 18
        const len18 = '0123456789ABCDEF01';
        expect(len18.length).toBe(18);
        expect(verify(len18)).toBe(false);
        expect(parse(len18)).toEqual({
            ok: false,
            error: 'Invalid ID length: expected 16 characters, got 18',
        });

        // Length 20
        const len20 = '0123-4567-89AB-CDEN0';
        expect(len20.length).toBe(20);
        expect(verify(len20)).toBe(false);
        expect(parse(len20)).toEqual({
            ok: false,
            error: 'Invalid ID length: expected 16 characters, got 20',
        });

        // Whitespace-only string trims to empty string (length 0)
        expect(verify('   ')).toBe(false);
        expect(parse('   ')).toEqual({
            ok: false,
            error: 'Invalid ID length: expected 16 characters, got 0',
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
            error: "Invalid ID: '0123456789ABCDEU' contains invalid character",
        });

        // Valid hyphen placement and valid alphabet, but invalid checksum
        const invalidChecksumFormatted = '0123-4567-89AB-CDEF';
        expect(verify(invalidChecksumFormatted)).toBe(false);
        expect(parse(invalidChecksumFormatted)).toEqual({
            ok: false,
            error: "Invalid ID: '0123456789ABCDEF' failed checksum validation",
        });
    });

    it('triggers every hyphen failure branch for 19-character inputs', () => {
        const expectedFormatError = {
            ok: false,
            error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14',
        } as const;

        // Missing hyphen at index 4
        const missingHyphen4 = '012345678-89AB-CDEN';
        expect(verify(missingHyphen4)).toBe(false);
        expect(parse(missingHyphen4)).toEqual(expectedFormatError);

        // Missing hyphen at index 9
        const missingHyphen9 = '0123-4567889AB-CDEN';
        expect(verify(missingHyphen9)).toBe(false);
        expect(parse(missingHyphen9)).toEqual(expectedFormatError);

        // Missing hyphen at index 14
        const missingHyphen14 = '0123-4567-89ABCCDEN';
        expect(verify(missingHyphen14)).toBe(false);
        expect(parse(missingHyphen14)).toEqual(expectedFormatError);

        // Extra hyphen before position 4 (e.g. index 0)
        const hyphenAt0 = '-123-4567-89AB-CDEN';
        expect(verify(hyphenAt0)).toBe(false);
        expect(parse(hyphenAt0)).toEqual(expectedFormatError);

        // Extra hyphen between groups (e.g. index 5)
        const doubleHyphen5 = '0123--567-89AB-CDEN';
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
        for (const badInput of ['INVALID_LENGTH', '0123456789ABCDU0', null, undefined, 12345, true, {}]) {
            const parseRes = parse(badInput);
            const formatRes = format(badInput);
            expect(formatRes.ok).toBe(false);
            if (!formatRes.ok && !parseRes.ok) {
                expect(formatRes.error).toBe(parseRes.error);
            }
        }
    });
});

describe('unformat() (deprecated)', () => {
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
