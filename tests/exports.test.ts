/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import { describe, expect, it } from 'bun:test';
import * as sid from '../src/index';

// -------------------------------------------------------------------
// 2. Test Suite: Public Runtime API
// -------------------------------------------------------------------

describe('Public runtime API', () => {
    it('exports exactly the documented functions and no runtime brand values', () => {
        expect(Object.keys(sid).sort()).toEqual([
            'format',
            'generate',
            'generateFormatted',
            'isFormattedSID',
            'isSID',
            'parse',
            'verify',
        ]);
    });
});
