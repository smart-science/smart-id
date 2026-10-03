// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Types
// -------------------------------------------------------------------

/**
 * Validated, canonical 20-character identifier. A branded string: plain at runtime, distinct from `string`
 * at compile time. Obtain it from `generate()`, `fromBytes()`, `parse()`, or `isSID()`; `__sidBrand` exists only in the type.
 */
// biome-ignore lint/style/useNamingConvention: public API name + type-only brand key
export type SID = string & { readonly __sidBrand: 'SID' };

/**
 * Validated, canonical 24-character identifier `XXXX-XXXX-XXXX-XXXX-XXXX`. A branded string like `SID`.
 * Obtain it from `generateFormatted()`, `format()`, or `isFormattedSID()`.
 */
export type FormattedSID = `${string}-${string}-${string}-${string}-${string}` & {
    // biome-ignore lint/style/useNamingConvention: type-only brand key
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
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const;

/** Required length of the raw identifier payload - excl. checksum. */
const PAYLOAD_LENGTH = 18;

/** Minimum byte count for `fromBytes()`: 18 characters x 5 bits = 90 bits, rounded up to 12 bytes. */
const MIN_BYTES = 12;

/** `%TypedArray%.prototype[Symbol.toStringTag]` getter: reads `[[TypedArrayName]]`, works across realms, never throws. */
// INTENTION: hoisted configuration reference
const typedArrayName: ((this: unknown) => unknown) | undefined = Object.getOwnPropertyDescriptor(
    Reflect.getPrototypeOf(Uint8Array.prototype),
    Symbol.toStringTag,
)?.get;

/** Required length of the complete raw identifier incl. checksum (2 check characters = 10 bits). */
const TOTAL_LENGTH = 20;

/** Required length of the formatted identifier `XXXX-XXXX-XXXX-XXXX-XXXX`. */
const FORMATTED_LENGTH = 24;

/** ASCII decode table: canonical + lowercase chars, `I/i/L/l` -> 1, `O/o` -> 0, else -1. */
const DECODE = new Int8Array(128).fill(-1);
const LOWER_ALPHABET = CROCKFORD_ALPHABET.toLowerCase();
for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
    const charCode = CROCKFORD_ALPHABET.charCodeAt(i);
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

/** 10-bit check value for a weighted payload sum `Σ val_i * (i + 1)`: `sum mod 1024`. */
function checkValue(sum: number): number {
    return sum & 0x3ff;
}

// -------------------------------------------------------------------
// 3. Exported Functions
// -------------------------------------------------------------------

/**
 * **Generates a random 20-character identifier with a valid checksum.**
 *
 * - uses `globalThis.crypto.getRandomValues` to generate 18 random Crockford Base32 characters
 * - appends the 2 calculated weighted Modulo-1024 check characters.
 *
 * @returns Canonical 20-character unhyphenated `SID`.
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
    return encode(bytes);
}

/**
 * **Derives a deterministic 20-character identifier from raw bytes, e.g. a SHA-256 digest.**
 *
 * - reads the first 90 bits (MSB-first) as 18 Crockford Base32 characters; later bits are ignored
 * - appends the 2 calculated weighted Modulo-1024 check characters
 *
 * Same bytes always yield the same `SID`. Hashing is left to the caller to keep the package runtime-agnostic:
 * Node.js/Bun `createHash('sha256').update(text).digest()`, browsers `new Uint8Array(await crypto.subtle.digest('SHA-256', data))`.
 *
 * Never throws; safe against non-`Uint8Array` and too short inputs.
 *
 * @param bytes - At least 12 bytes (`Buffer` accepted).
 * @returns Canonical 20-character unhyphenated `SID`, or `null` if `bytes` is not a `Uint8Array` or shorter than 12 bytes.
 */
export function fromBytes(bytes: Uint8Array): SID | null {
    // check `isView` first: `instanceof` throws on revoked proxies.
    if (
        !ArrayBuffer.isView(bytes) ||
        (!(bytes instanceof Uint8Array) && typedArrayName?.call(bytes) !== 'Uint8Array') ||
        bytes.length < MIN_BYTES
    ) {
        return null;
    }

    const values = new Uint8Array(PAYLOAD_LENGTH);
    let buffer = 0;
    let bits = 0;
    let byteIndex = 0;
    for (let i = 0; i < PAYLOAD_LENGTH; i++) {
        if (bits < 5) {
            buffer = (buffer << 8) | (bytes[byteIndex++] ?? 0);
            bits += 8;
        }
        bits -= 5;
        values[i] = buffer >>> bits;
        // keep only unread bits so `buffer` never exceeds 12 bits.
        buffer &= (1 << bits) - 1;
    }
    return encode(values);
}

/**
 * **Generates a formatted identifier grouped as `XXXX-XXXX-XXXX-XXXX-XXXX`.**
 *
 * - generates a canonical 20-character `SID`
 * - groups it into a 24-character hyphenated `FormattedSID` string
 *
 * @returns Formatted 24-character hyphenated `FormattedSID` string.
 * @throws {TypeError} If the runtime has no global Web Crypto (`globalThis.crypto.getRandomValues`), e.g. Node.js 18 and older.
 */
export function generateFormatted(): FormattedSID {
    return toQuadString(generate());
}

/**
 * **Verifies if input is valid raw or formatted identifier.**
 *
 * - validates length (20-character raw or 24-character formatted)
 * - validates Crockford Base32 character set
 * - validates weighted Modulo-1024 checksum
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
 * **Type guard verifying if an input is strictly a canonical 20-character SID.**
 *
 * Unlike `verify()`, which accepts formatted (`XXXX-XXXX-XXXX-XXXX-XXXX`), lowercase,
 * whitespace-padded, or repaired variants, `isSID()` returns `true` *only* if the input
 * is already an exact canonical unhyphenated uppercase 20-character `SID`. Never throws.
 *
 * @param input - Value to validate.
 * @returns `true` if input is an exact canonical `SID`, narrowing the type.
 */
export function isSID(input: unknown): input is SID {
    if (typeof input !== 'string' || input.length !== TOTAL_LENGTH) {
        return false;
    }
    const parsed = parse(input);
    return parsed.ok && parsed.data === input;
}

/**
 * **Type guard verifying if an input is strictly a canonical formatted SID (`XXXX-XXXX-XXXX-XXXX-XXXX`).**
 *
 * Unlike `verify()`, which accepts unhyphenated, lowercase, whitespace-padded, or repaired
 * variants, `isFormattedSID()` returns `true` *only* if the input is already an exact
 * canonical 24-character hyphenated uppercase `FormattedSID`. Never throws.
 *
 * @param input - Value to validate.
 * @returns `true` if input is an exact canonical `FormattedSID`, narrowing the type.
 */
export function isFormattedSID(input: unknown): input is FormattedSID {
    if (typeof input !== 'string' || input.length !== FORMATTED_LENGTH) {
        return false;
    }
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
 * - strips hyphens from valid 24-character quad format
 * - verifies Crockford Base32 alphabet (reporting invalid character and index in trimmed input)
 * - verifies weighted Modulo-1024 checksum (2 check characters)
 *
 * Never throws; safe against non-string and malformed inputs.
 *
 * @param input - Raw or formatted SID.
 * @returns `SidResult<SID>` containing canonical 20-character `SID` on success, else error result.
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
            sum += val * (i + 1);
        } else if (val !== (i === PAYLOAD_LENGTH ? (checkValue(sum) >> 5) & 31 : checkValue(sum) & 31)) {
            return {
                ok: false,
                code: 'CHECKSUM_MISMATCH',
                error: `Invalid ID ${JSON.stringify(trimmed)} failed checksum validation`,
            };
        }
        canonical += CROCKFORD_ALPHABET[val] ?? '';
    }

    return { ok: true, data: canonical as SID };
}

/**
 * **Formats an identifier into quad groups `XXXX-XXXX-XXXX-XXXX-XXXX`.**
 *
 * - parses and validates raw or formatted identifier input
 * - formats it into the 24-character quad group (`XXXX-XXXX-XXXX-XXXX-XXXX`)
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
 * **Formats a canonical 20-character `SID` into quad groups `XXXX-XXXX-XXXX-XXXX-XXXX`.**
 *
 * @param id - Canonical identifier string.
 * @returns Formatted identifier string.
 */
function toQuadString(id: SID): FormattedSID {
    return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}` as FormattedSID;
}

/**
 * **Encodes the first 18 values (each masked to 5 bits) into a canonical `SID` with check characters.**
 *
 * Shared by `generate()` and `fromBytes()`.
 *
 * @param values - At least 18 values; only the low 5 bits of each are used.
 * @returns Canonical 20-character `SID`.
 */
function encode(values: Uint8Array): SID {
    let payload = '';
    let sum = 0;
    for (let i = 0; i < PAYLOAD_LENGTH; i++) {
        const val = (values[i] ?? 0) & 31;
        sum += val * (i + 1);
        payload += CROCKFORD_ALPHABET[val] ?? '';
    }

    const check = checkValue(sum);
    return (payload + (CROCKFORD_ALPHABET[(check >> 5) & 31] ?? '') + (CROCKFORD_ALPHABET[check & 31] ?? '')) as SID;
}

/**
 * **Normalizes raw input into canonical 20-character format.**
 *
 * - trims whitespace
 * - validates hyphen positions (`XXXX-XXXX-XXXX-XXXX-XXXX`) and strips them
 *
 * Does not change case, repair ambiguous characters, or validate alphabet membership and checksum;
 * `parse()` does all of that in a single pass over the ASCII decode table.
 *
 * @param input - Raw input to normalize.
 * @returns Cleaned 20-character string alongside trimmed input on success, or an error result.
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
            trimmed.indexOf('-', 15) === 19 &&
            trimmed.indexOf('-', 20) === -1
        ) {
            return {
                ok: true,
                data: {
                    trimmed,
                    clean:
                        trimmed.slice(0, 4) +
                        trimmed.slice(5, 9) +
                        trimmed.slice(10, 14) +
                        trimmed.slice(15, 19) +
                        trimmed.slice(20),
                },
            };
        }
        return {
            ok: false,
            code: 'INVALID_FORMAT',
            error: 'Invalid ID format: expected XXXX-XXXX-XXXX-XXXX-XXXX with hyphens at positions 4, 9, 14, 19 (0-based)',
        };
    }

    return {
        ok: false,
        code: 'INVALID_LENGTH',
        error: `Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got ${trimmed.length}`,
    };
}
