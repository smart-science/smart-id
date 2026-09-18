/*!
 * Copyright 2026 Martin Winkler
 * SPDX-License-Identifier: Apache-2.0
 */

// -------------------------------------------------------------------
// 1. Type Declarations
// -------------------------------------------------------------------

/**
 * Validated, canonical 16-character identifier. A branded string: plain at runtime, distinct from `string`
 * at compile time. Obtain it from `generate()`, `parse()`, or `isSID()`; `__sidBrand` exists only in the type.
 */
export type SID = string & { readonly __sidBrand: 'SID' };

/**
 * Validated, canonical 19-character identifier `XXXX-XXXX-XXXX-XXXX`. A branded string like `SID`.
 * Obtain it from `generateFormatted()`, `format()`, or `isFormattedSID()`.
 */
export type FormattedSID = `${string}-${string}-${string}-${string}` & {
    readonly __sidBrand: 'FormattedSID';
};

/** Machine-readable reason why `parse()` or `format()` failed. */
export type SidErrorCode =
    | 'NOT_A_STRING'
    | 'INVALID_LENGTH'
    | 'INVALID_FORMAT'
    | 'INVALID_CHARACTER'
    | 'CHECKSUM_MISMATCH';

/** Result of `parse()` and `format()`: success with `data`, or failure with `code` and `error`. */
export type SidResult<T> =
    | {
          /** Successful operation indicator. */
          readonly ok: true;
          /** Result payload data. */
          readonly data: T;
      }
    | {
          /** Failed operation indicator. */
          readonly ok: false;
          /** Machine-readable error code. */
          readonly code: SidErrorCode;
          /** Human-readable message; branch on `code` instead, as the wording may change. */
          readonly error: string;
      };

// -------------------------------------------------------------------
// 2. Constants & Dictionaries
// -------------------------------------------------------------------

/** Canonical Crockford Base32 alphabet: excludes [`I`, `L`, `O`, `U`]. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const;

/** Required length of the raw identifier payload - excl. checksum. */
const PAYLOAD_LENGTH = 15;

/** Required length of the complete raw identifier incl. checksum. */
const TOTAL_LENGTH = 16;

/** Required length of the formatted identifier `XXXX-XXXX-XXXX-XXXX`. */
const FORMATTED_LENGTH = 19;

/** ASCII decode table: canonical + lowercase chars, `I/i/L/l` -> 1, `O/o` -> 0, else -1. */
const DECODE = new Int8Array(128).fill(-1);
const LOWER_ALPHABET = ALPHABET.toLowerCase();
for (let i = 0; i < ALPHABET.length; i++) {
    const charCode = ALPHABET.charCodeAt(i);
    DECODE[charCode] = i;
    const lowerCharCode = LOWER_ALPHABET.charCodeAt(i);
    DECODE[lowerCharCode] = i;
}
for (const c of 'IiLl') {
    DECODE[c.charCodeAt(0)] = 1;
}
for (const c of 'Oo') {
    DECODE[c.charCodeAt(0)] = 0;
}

/** Check value for a weighted payload sum: solves `sum + 3 * check ≡ 0 (mod 32)`. */
function checkValue(sum: number): number {
    return ((32 - (sum % 32)) * 11) % 32;
}

// -------------------------------------------------------------------
// 3. Exported Functions
// -------------------------------------------------------------------

/**
 * **Generates a random 16-character identifier with a valid checksum.**
 *
 * - uses `globalThis.crypto.getRandomValues` to generate 15 random Crockford Base32 characters
 * - appends the calculated Modulo-32 check character.
 *
 * @returns Canonical 16-character unhyphenated `SID`.
 * @throws {TypeError} If the runtime has no global Web Crypto (`globalThis.crypto.getRandomValues`), e.g. Node.js 18 and older.
 */
export function generate(): SID {
    const webCrypto = globalThis.crypto;
    if (typeof webCrypto?.getRandomValues !== 'function') {
        throw new TypeError(
            'generate() requires Web Crypto (globalThis.crypto.getRandomValues), which this runtime lacks',
        );
    }
    const bytes = new Uint8Array(PAYLOAD_LENGTH);
    webCrypto.getRandomValues(bytes);

    let payload = '';
    let sum = 0;
    for (let i = 0; i < PAYLOAD_LENGTH; i++) {
        const val = (bytes[i] ?? 0) & 31;
        sum += val * (i % 2 === 0 ? 1 : 3);
        payload += ALPHABET[val] ?? '';
    }

    const check = checkValue(sum);
    return (payload + (ALPHABET[check] ?? '')) as SID;
}

/**
 * **Generates a formatted identifier grouped as `XXXX-XXXX-XXXX-XXXX`.**
 *
 * - generates a canonical 16-character `SID`
 * - groups it into a 19-character hyphenated `FormattedSID` string
 *
 * @returns Formatted 19-character hyphenated `FormattedSID` string.
 * @throws {TypeError} If the runtime has no global Web Crypto (`globalThis.crypto.getRandomValues`), e.g. Node.js 18 and older.
 */
export function generateFormatted(): FormattedSID {
    return toQuadString(generate());
}

/**
 * **Verifies if input is valid raw or formatted identifier.**
 *
 * - validates length (16-character raw or 19-character formatted)
 * - validates Crockford Base32 character set
 * - validates Modulo-32 checksum
 *
 * Never throws; safe against non-string and malformed inputs.
 *
 * @param input - Raw or formatted SID.
 * @returns `true` if valid, else `false`.
 */
export function verify(input: unknown): boolean {
    return parse(input).ok;
}

/**
 * **Type guard verifying if an input is strictly a canonical 16-character SID.**
 *
 * Unlike `verify()`, which accepts formatted (`XXXX-XXXX-XXXX-XXXX`), lowercase,
 * whitespace-padded, or repaired variants, `isSID()` returns `true` *only* if the input
 * is already an exact canonical unhyphenated uppercase 16-character `SID`. Never throws.
 *
 * @param input - Value to validate.
 * @returns `true` if input is an exact canonical `SID`, narrowing the type.
 */
export function isSID(input: unknown): input is SID {
    const parsed = parse(input);
    return parsed.ok && parsed.data === input;
}

/**
 * **Type guard verifying if an input is strictly a canonical formatted SID (`XXXX-XXXX-XXXX-XXXX`).**
 *
 * Unlike `verify()`, which accepts unhyphenated, lowercase, whitespace-padded, or repaired
 * variants, `isFormattedSID()` returns `true` *only* if the input is already an exact
 * canonical 19-character hyphenated uppercase `FormattedSID`. Never throws.
 *
 * @param input - Value to validate.
 * @returns `true` if input is an exact canonical `FormattedSID`, narrowing the type.
 */
export function isFormattedSID(input: unknown): input is FormattedSID {
    const formatted = format(input);
    return formatted.ok && formatted.data === input;
}

/**
 * **Parses and validates an identifier into a canonical `SID`.**
 *
 * - trims whitespace
 * - accepts lowercase characters (output is uppercase)
 * - repairs ambiguous characters
 *    - `I`/`L` -> `1`
 *    - `O` -> `0`
 * - strips hyphens from valid 19-character quad format
 * - verifies Crockford Base32 alphabet (reporting invalid character and index in trimmed input)
 * - verifies Modulo-32 checksum
 *
 * Never throws; safe against non-string and malformed inputs.
 *
 * @param input - Raw or formatted SID.
 * @returns `SidResult<SID>` containing canonical 16-character `SID` on success, else error result.
 */
export function parse(input: unknown): SidResult<SID> {
    const normalized = normalize(input);
    if (!normalized.ok) {
        return normalized;
    }

    const { trimmed, clean } = normalized.data;
    let canonical = '';
    let sum = 0;
    for (let i = 0; i < TOTAL_LENGTH; i++) {
        const code = clean.charCodeAt(i);
        const val = DECODE[code] ?? -1;
        if (val === -1) {
            // UTF-16 index into the trimmed input; formatted input shifts by one per preceding hyphen
            const index = trimmed.length === FORMATTED_LENGTH ? i + Math.floor(i / 4) : i;
            const char = String.fromCodePoint(trimmed.codePointAt(index) ?? 0);
            return {
                ok: false,
                code: 'INVALID_CHARACTER',
                error: `Invalid ID ${JSON.stringify(trimmed)} contains invalid character ${JSON.stringify(char)} at index ${index}`,
            };
        }
        if (i < PAYLOAD_LENGTH) {
            sum += val * (i % 2 === 0 ? 1 : 3);
        } else if (val !== checkValue(sum)) {
            return {
                ok: false,
                code: 'CHECKSUM_MISMATCH',
                error: `Invalid ID ${JSON.stringify(trimmed)} failed checksum validation`,
            };
        }
        canonical += ALPHABET[val] ?? '';
    }

    return { ok: true, data: canonical as SID };
}

/**
 * **Formats an identifier into quad groups `XXXX-XXXX-XXXX-XXXX`.**
 *
 * - parses and validates raw or formatted identifier input
 * - formats it into the 19-character quad group (`XXXX-XXXX-XXXX-XXXX`)
 *
 * Never throws; safe against non-string and malformed inputs.
 *
 * @param input - Raw or formatted SID.
 * @returns `SidResult<FormattedSID>` containing formatted identifier on success, else error result.
 */
export function format(input: unknown): SidResult<FormattedSID> {
    const parsed = parse(input);
    if (!parsed.ok) {
        return parsed;
    }

    return {
        ok: true,
        data: toQuadString(parsed.data),
    };
}

// -------------------------------------------------------------------
// 4. Internal Helper Functions
// -------------------------------------------------------------------

/**
 * **Formats a canonical 16-character `SID` into quad groups `XXXX-XXXX-XXXX-XXXX`.**
 *
 * @param id - Canonical identifier string.
 * @returns Formatted identifier string.
 */
function toQuadString(id: SID): FormattedSID {
    return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}` as FormattedSID;
}

/**
 * **Normalizes raw input into canonical 16-character format.**
 *
 * - trims whitespace
 * - validates hyphen positions (`XXXX-XXXX-XXXX-XXXX`) and strips them
 *
 * Does not change case, repair ambiguous characters, or validate alphabet membership and checksum;
 * `parse()` does all of that in a single pass over the ASCII decode table.
 *
 * @param input - Raw input to normalize.
 * @returns Cleaned 16-character string alongside trimmed input on success, or an error result.
 */
function normalize(input: unknown): SidResult<{ trimmed: string; clean: string }> {
    if (typeof input !== 'string') {
        return {
            ok: false,
            code: 'NOT_A_STRING',
            error: `Expected string input, received ${input === null ? 'null' : typeof input}`,
        };
    }

    const trimmed = input.trim();

    if (trimmed.length === TOTAL_LENGTH) {
        return { ok: true, data: { trimmed, clean: trimmed } };
    }

    if (trimmed.length === FORMATTED_LENGTH) {
        if (
            trimmed.indexOf('-', 0) === 4 &&
            trimmed.indexOf('-', 5) === 9 &&
            trimmed.indexOf('-', 10) === 14 &&
            trimmed.indexOf('-', 15) === -1
        ) {
            return {
                ok: true,
                data: {
                    trimmed,
                    clean: trimmed.slice(0, 4) + trimmed.slice(5, 9) + trimmed.slice(10, 14) + trimmed.slice(15),
                },
            };
        }
        return {
            ok: false,
            code: 'INVALID_FORMAT',
            error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14 (0-based)',
        };
    }

    return {
        ok: false,
        code: 'INVALID_LENGTH',
        error: `Invalid ID length: expected 16 (raw) or 19 (XXXX-XXXX-XXXX-XXXX) characters, got ${trimmed.length}`,
    };
}
