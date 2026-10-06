// Copyright 2026 Martin Winkler
// SPDX-License-Identifier: Apache-2.0

import type { FormattedSID, SID } from '../src/index.js';

/** Canonical Crockford Base32 alphabet for tests. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Canonical fixed valid IDs for reproducible deterministic tests (v0.3 checksum). */
export const VALID_ID = '0123456789ABCDEFGHWJ' as SID;
export const VALID_ID_2 = 'VWXYZ0123456789ABCGV' as SID;
export const VALID_ID_ALL_ZERO = '00000000000000000000' as SID;

/**
 * Formats a 20-character string into quad groups `XXXX-XXXX-XXXX-XXXX-XXXX`.
 * Avoids repetitive inline template literal string slicing across tests.
 */
export function quad(id: string): FormattedSID {
    return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}` as FormattedSID;
}
