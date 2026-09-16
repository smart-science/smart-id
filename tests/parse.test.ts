/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { parse, verify } from '../src/index';
import { VALID_ID } from './helpers';

// -------------------------------------------------------------------
// 2. Test Suite: parse() & Unicode Normalization
// -------------------------------------------------------------------

describe('parse() - Unicode Safety & Case Mapping', () => {
    it('rejects Unicode case-mapping characters that uppercase to ASCII letters [F-53]', () => {
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

    it('rejects multibyte emoji with exact 16 UTF-16 code units via character check [F-44]', () => {
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

    it('repairs lowercase i, l, o inside formatted strings [F-54]', () => {
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
