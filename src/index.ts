/*!
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Type Declarations
// -------------------------------------------------------------------

export const SidBrand: unique symbol = Symbol('SidBrand');
export const FormattedSidBrand: unique symbol = Symbol('FormattedSidBrand');

/** Nominal branded type representing a validated, canonical 16-character identifier. */
export type SID = string & { readonly [SidBrand]: typeof SidBrand };

/** Formatted identifier string matching `XXXX-XXXX-XXXX-XXXX`. */
export type FormattedSID = `${string}-${string}-${string}-${string}` & {
    readonly [FormattedSidBrand]: typeof FormattedSidBrand;
};

/** Discriminated union result representing either {success, data} or {failure, error}. */
export type Result<T> =
    | {
          /** Successful operation indicator. */
          readonly ok: true;
          /** Result payload data. */
          readonly data: T;
      }
    | {
          /** Failed operation indicator. */
          readonly ok: false;
          /** Error message describing failure reason. */
          readonly error: string;
      };

// -------------------------------------------------------------------
// 2. Regular Expressions
// -------------------------------------------------------------------

/**
 * **Matches uppercase ambiguous Crockford Base32 characters for replacement.**
 * - `I`, `L` -> `1`.
 * - `O` -> `0`.
 */
const REGEX_AMBIGUOUS = /[ILO]/g;

// -------------------------------------------------------------------
// 3. Constants & Dictionaries
// -------------------------------------------------------------------

/** Canonical Crockford Base32 alphabet: excludes [`I`, `L`, `O`, `U`]. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const;

/** Required length of the raw identifier payload - excl. checksum. */
const PAYLOAD_LENGTH = 15;

/** Required length of the complete raw identifier incl. checksum. */
const TOTAL_LENGTH = 16;

/** Direct byte lookup table mapping character codes to numerical values (0-31), `-1` for invalid characters. */
const CHAR_LOOKUP = new Int8Array(256).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
    CHAR_LOOKUP[ALPHABET.charCodeAt(i)] = i;
}

// -------------------------------------------------------------------
// 4. Exported Functions
// -------------------------------------------------------------------

/**
 * **Generates a random 16-character identifier with a valid checksum.**
 *
 * - uses `globalThis.crypto.getRandomValues` to generate 15 random Crockford Base32 characters
 * - appends the calculated Modulo-32 check character.
 *
 * @returns Canonical 16-character unhyphenated `SID`.
 * @throws {TypeError} If runtime environment lacks Crypto (`globalThis.crypto.getRandomValues`).
 */
export function generate(): SID {
    const bytes = new Uint8Array(PAYLOAD_LENGTH);
    globalThis.crypto.getRandomValues(bytes);

    let payload = '';
    let sum = 0;
    for (let i = 0; i < PAYLOAD_LENGTH; i++) {
        const val = bytes[i] & 31;
        sum += val * (i % 2 === 0 ? 1 : 3);
        payload += ALPHABET[val];
    }

    const checkValue = (32 - (sum % 32)) % 32;
    return (payload + ALPHABET[checkValue]) as SID;
}

/**
 * **Generates a formatted identifier grouped as `XXXX-XXXX-XXXX-XXXX`.**
 *
 * - generates a canonical 16-character `SID`
 * - groups it into a 19-character hyphenated `FormattedSID` string
 *
 * @returns Formatted 19-character hyphenated `FormattedSID` string.
 * @throws {TypeError} If runtime environment lacks Crypto (`globalThis.crypto.getRandomValues`).
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
 * Safe against non-string and malformed inputs.
 *
 * @param input - Raw or formatted SID.
 * @returns `true` if valid, else `false`.
 */
export function verify(input: unknown): boolean {
    const normalized = normalize(input);
    if (!normalized.ok) {
        return false;
    }

    return validateNormalized(normalized.data) === 0;
}

/**
 * **Parses and validates an identifier into a canonical `SID`.**
 *
 * - trims whitespace
 * - normalizes lowercase characters to uppercase
 * - repairs ambiguous characters
 *    - `I`/`L` -> `1`
 *    - `O` -> `0`
 * - strips hyphens from valid 19-character quad format
 * - verifies Crockford Base32 alphabet
 * - verifies Modulo-32 checksum
 *
 * Safe against non-string and malformed inputs.
 *
 * @param input - Raw or formatted SID.
 * @returns `Result<SID>` containing canonical 16-character `SID` on success, else error string.
 */
export function parse(input: unknown): Result<SID> {
    const normalized = normalize(input);
    if (!normalized.ok) {
        return normalized;
    }

    const status = validateNormalized(normalized.data);
    if (status === 1) {
        return {
            ok: false,
            error: `Invalid ID: '${normalized.data}' contains invalid character`,
        };
    }
    if (status === 2) {
        return {
            ok: false,
            error: `Invalid ID: '${normalized.data}' failed checksum validation`,
        };
    }

    return { ok: true, data: normalized.data as SID };
}

/**
 * **Formats an identifier into quad groups `XXXX-XXXX-XXXX-XXXX`.**
 *
 * - parses and validates raw or formatted identifier input
 * - formatting into 19-character quad group (`XXXX-XXXX-XXXX-XXXX`)
 *
 * @param input - Raw or unhyphenated SID.
 * @returns `Result<FormattedSID>` containing formatted identifier on success, else error string.
 */
export function format(input: unknown): Result<FormattedSID> {
    const parsed = parse(input);
    if (!parsed.ok) {
        return parsed;
    }

    return {
        ok: true,
        data: toQuadString(parsed.data),
    };
}

/**
 * **Converts a formatted identifier back to its canonical 16-character representation.**
 *
 * Assumes input was already parsed and validated; for unvalidated input, use `parse()`.
 *
 * - strips hyphens at fixed indices (`4, 9, 14`) - direct string slicing.
 *
 * @param id - Validated formatted SID.
 * @returns Canonical 16-character unhyphenated `SID`.
 * @throws {TypeError} In untyped JavaScript if `id` is not a string (e.g. `null` or `undefined`).
 */
export function unformat(id: FormattedSID): SID {
    return (id.slice(0, 4) + id.slice(5, 9) + id.slice(10, 14) + id.slice(15)) as SID;
}

// -------------------------------------------------------------------
// 5. Internal Helper Functions
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
 * - normalizes lowercase characters to uppercase
 * - repairs ambiguous characters (`I`/`L` -> `1`, `O` -> `0`)
 * - validates hyphen positions (`XXXX-XXXX-XXXX-XXXX`) and strips them
 *
 * Does not validate alphabet membership or checksum (`validateNormalized` does).
 *
 * @param input - Raw input to normalize.
 * @returns Cleaned 16-character uppercase string on success, or an error result.
 */
function normalize(input: unknown): Result<string> {
    if (typeof input !== 'string') {
        return { ok: false, error: `Expected string input, received ${typeof input}` };
    }

    const upper = input
        .trim()
        .toUpperCase()
        .replace(REGEX_AMBIGUOUS, (match) => (match === 'O' ? '0' : '1'));

    if (upper.length === TOTAL_LENGTH) {
        return { ok: true, data: upper };
    }

    if (upper.length === 19) {
        if (
            upper.indexOf('-', 0) === 4 &&
            upper.indexOf('-', 5) === 9 &&
            upper.indexOf('-', 10) === 14 &&
            upper.indexOf('-', 15) === -1
        ) {
            return {
                ok: true,
                data: upper.slice(0, 4) + upper.slice(5, 9) + upper.slice(10, 14) + upper.slice(15),
            };
        }
        return {
            ok: false,
            error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14',
        };
    }

    return {
        ok: false,
        error: `Invalid ID length: expected ${TOTAL_LENGTH} characters, got ${upper.length}`,
    };
}

/**
 * **Validates alphabet membership and checksum on a 16-character string in a single pass.**
 *
 * @param clean - Guaranteed 16-character pre-normalized string without delimiters.
 * @returns Status code: `0` for valid, `1` for invalid alphabet character, `2` for checksum mismatch.
 */
function validateNormalized(clean: string): 0 | 1 | 2 {
    // INVARIANT: modulo-32 arithmetic cannot detect adjacent transpositions with char distance 16.
    let sum = 0;
    for (let i = 0; i < PAYLOAD_LENGTH; i++) {
        const code = clean.charCodeAt(i);
        const val = code < 256 ? CHAR_LOOKUP[code] : -1;
        if (val === -1) {
            return 1;
        }
        // alternating odd weights coprime to 32 catch all single-char substitutions.
        sum += val * (i % 2 === 0 ? 1 : 3);
    }

    // validate the 16th check char directly via table lookup.
    const checkCode = clean.charCodeAt(PAYLOAD_LENGTH);
    const checkVal = checkCode < 256 ? CHAR_LOOKUP[checkCode] : -1;
    if (checkVal === -1) {
        return 1;
    }
    return checkVal === (32 - (sum % 32)) % 32 ? 0 : 2;
}
