/*
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FormattedSID, SID } from '../src/index';

/** Canonical Crockford Base32 alphabet for tests. */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Canonical fixed valid IDs for reproducible deterministic tests (v0.2 checksum). */
export const VALID_ID = '0123456789ABCDE7' as SID;
export const VALID_ID_2 = 'VWXYZ01234567892' as SID;
export const VALID_ID_ALL_ZERO = '0000000000000000' as SID;
export const VALID_FORMATTED = '0123-4567-89AB-CDE7' as FormattedSID;

/**
 * Formats a 16-character string into quad groups `XXXX-XXXX-XXXX-XXXX`.
 * Avoids repetitive inline template literal string slicing across tests.
 */
export function quad(id: string): FormattedSID {
    return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}` as FormattedSID;
}
