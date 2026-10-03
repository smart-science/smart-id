// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import * as sid from '../src/index.js';

// -------------------------------------------------------------------
// 2. Test Suite: Public Runtime API
// -------------------------------------------------------------------

describe('Public runtime API', () => {
    it('exports exactly the documented functions and no runtime brand values', () => {
        expect(Object.keys(sid).sort()).toEqual([
            'CROCKFORD_ALPHABET',
            'format',
            'fromBytes',
            'generate',
            'generateFormatted',
            'isFormattedSID',
            'isSID',
            'parse',
            'verify',
        ]);
    });
});
