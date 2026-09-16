/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import { isFormattedSID, isSID } from '../src/index';
import { quad, VALID_FORMATTED, VALID_ID, VALID_ID_2, VALID_ID_ALL_ZERO } from './helpers';

// -------------------------------------------------------------------
// 2. Test Suite: Strict Type Guards
// -------------------------------------------------------------------

describe('Strict Type Guards: isSID() and isFormattedSID()', () => {
    describe('isSID()', () => {
        it('returns true only for exact canonical 16-character uppercase identifiers', () => {
            expect(isSID(VALID_ID)).toBe(true);
            expect(isSID(VALID_ID_2)).toBe(true);
            expect(isSID(VALID_ID_ALL_ZERO)).toBe(true);
        });

        it('returns false for lowercase variants of valid identifiers', () => {
            expect(isSID(VALID_ID.toLowerCase())).toBe(false);
            expect(isSID(VALID_ID_2.toLowerCase())).toBe(false);
        });

        it('returns false for whitespace-padded identifiers', () => {
            expect(isSID(` ${VALID_ID}`)).toBe(false);
            expect(isSID(`${VALID_ID} `)).toBe(false);
            expect(isSID(`\n\t${VALID_ID}\r\n`)).toBe(false);
        });

        it('returns false for formatted quad-grouped identifiers', () => {
            expect(isSID(VALID_FORMATTED)).toBe(false);
            expect(isSID(quad(VALID_ID))).toBe(false);
        });

        it('returns false for repaired ambiguous character inputs', () => {
            // 'OI23...' repairs to '0123...' under parse(), but is not canonical input
            expect(isSID('OI23456789ABCDE7')).toBe(false);
            expect(isSID('OL23456789ABCDE7')).toBe(false);
        });

        it('returns false for invalid lengths', () => {
            expect(isSID('')).toBe(false);
            expect(isSID('0123456789ABCDE')).toBe(false);
            expect(isSID('0123456789ABCDEFG')).toBe(false);
        });

        it('returns false for valid alphabet with invalid checksum', () => {
            expect(isSID('0123456789ABCDEF')).toBe(false);
        });
    });

    describe('isFormattedSID()', () => {
        it('returns true only for exact canonical XXXX-XXXX-XXXX-XXXX uppercase strings', () => {
            expect(isFormattedSID(VALID_FORMATTED)).toBe(true);
            expect(isFormattedSID(quad(VALID_ID))).toBe(true);
            expect(isFormattedSID(quad(VALID_ID_2))).toBe(true);
        });

        it('returns false for raw unhyphenated identifiers', () => {
            expect(isFormattedSID(VALID_ID)).toBe(false);
            expect(isFormattedSID(VALID_ID_2)).toBe(false);
        });

        it('returns false for lowercase formatted identifiers', () => {
            expect(isFormattedSID(VALID_FORMATTED.toLowerCase())).toBe(false);
        });

        it('returns false for whitespace-padded formatted identifiers', () => {
            expect(isFormattedSID(` ${VALID_FORMATTED}`)).toBe(false);
            expect(isFormattedSID(`${VALID_FORMATTED} `)).toBe(false);
            expect(isFormattedSID(`\t${VALID_FORMATTED}\n`)).toBe(false);
        });

        it('returns false for repaired ambiguous characters inside formatted strings', () => {
            expect(isFormattedSID('oi23-4567-89ab-cde7')).toBe(false);
            expect(isFormattedSID('OI23-4567-89AB-CDE7')).toBe(false);
        });

        it('returns false for misplaced hyphens and invalid lengths', () => {
            expect(isFormattedSID('0123--567-89AB-CDE7')).toBe(false);
            expect(isFormattedSID('01234-5678-9ABC-DE7')).toBe(false);
            expect(isFormattedSID('0123-4567-89AB-CDE')).toBe(false);
        });

        it('returns false for invalid characters or checksum failure', () => {
            expect(isFormattedSID('0123-4567-89AB-CDEU')).toBe(false);
            expect(isFormattedSID('0123-4567-89AB-CDEF')).toBe(false);
        });
    });
});
