// Copyright 2026 Martin Winkler

// -------------------------------------------------------------------
// 1. Types
// -------------------------------------------------------------------

/**
 * Validated, canonical 20-character identifier.
 *
 * @spec 0004: Canonical form: uppercase, unhyphenated, no whitespace.
 * @spec 0008: Branding: `SID` and `FormattedSID` are compile-time branded strings; plain strings at runtime.
 * @spec 0009: Brand key: `__sidBrand` exists only in the type; runtime values have no such property.
 * @spec 0011: `SID` producers: `generate()`, `fromBytes()`, `parse()`, `isSID()`.
 */
// biome-ignore lint/style/useNamingConvention: public API name + type-only brand key
export type SID = string & { readonly __sidBrand: 'SID' };

/**
 * Validated, canonical 24-character formatted identifier `XXXX-XXXX-XXXX-XXXX-XXXX`.
 *
 * @spec 0005: Formatted layout: 24 characters `XXXX-XXXX-XXXX-XXXX-XXXX` (hyphens at 0-based indices 4, 9, 14, 19).
 * @spec 0010: `FormattedSID` type: template literal `${string}-${string}-${string}-${string}-${string}` plus brand.
 * @spec 0012: `FormattedSID` producers: `generateFormatted()`, `format()`, `isFormattedSID()`.
 */
export type FormattedSID = `${string}-${string}-${string}-${string}-${string}` & {
    // biome-ignore lint/style/useNamingConvention: type-only brand key
    readonly __sidBrand: 'FormattedSID';
};

/**
 * Machine-readable reason why `parse()` or `format()` failed.
 *
 * @spec 0015: Error codes: `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, `INVALID_CHARACTER`, `CHECKSUM_MISMATCH`.
 */
export type SidErrorCode =
    | 'NOT_A_STRING'
    | 'INVALID_LENGTH'
    | 'INVALID_FORMAT'
    | 'INVALID_CHARACTER'
    | 'CHECKSUM_MISMATCH';

/**
 * Result of `parse()` and `format()`: success with `data`, or failure with `code` and `error`.
 *
 * @spec 0013: Result type: `parse()` and `format()` return `SidResult<T>`, a union discriminated by `ok`.
 * @spec 0016: Immutability: `SidResult` properties are readonly.
 */
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
          /**
           * Machine-readable error code.
           *
           * @spec 0014: Error code: `code` is the stable contract; branch on it.
           */
          readonly code: SidErrorCode;
          /**
           * Human-readable message.
           *
           * @spec 0044: Error message: `error` is diagnostic only; wording may change between versions.
           */
          readonly error: string;
      };

// -------------------------------------------------------------------
// 2. Constants & Dictionaries
// -------------------------------------------------------------------

/**
 * Canonical Crockford Base32 alphabet.
 *
 * @spec 0002: Alphabet: Crockford Base32 `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (excludes I, L, O, U).
 * @spec 0043: Export: alphabet exported as `CROCKFORD_ALPHABET`; character index = 5-bit value.
 */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const;

/** @spec 0003: Bit capacity: 5 bits per character; 18-character payload = 90 bits. */
const PAYLOAD_LENGTH = 18;

/** @spec 0046: Input length: `fromBytes()` requires >= 12 bytes (90 bits rounded up); shorter input returns `null`. */
const MIN_BYTES = 12;

/** `%TypedArray%.prototype[Symbol.toStringTag]` getter: reads `[[TypedArrayName]]`, works across realms, never throws. */
// INTENTION: hoisted configuration reference
const typedArrayName: ((this: unknown) => unknown) | undefined = Object.getOwnPropertyDescriptor(
    Reflect.getPrototypeOf(Uint8Array.prototype),
    Symbol.toStringTag,
)?.get;

/** @spec 0001: Length: 20 characters (18 payload characters, 2 check characters). */
const TOTAL_LENGTH = 20;

/** Required length of the formatted identifier `XXXX-XXXX-XXXX-XXXX-XXXX`. */
const FORMATTED_LENGTH = 24;

/** ASCII decode table: char code -> 5-bit value, -1 if invalid. */
const DECODE = new Int8Array(128).fill(-1);
const LOWER_ALPHABET = CROCKFORD_ALPHABET.toLowerCase();
/** @spec 0030: Case tolerance: input decoding is case-insensitive. */
for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
    const charCode = CROCKFORD_ALPHABET.charCodeAt(i);
    DECODE[charCode] = i;
    const lowerCharCode = LOWER_ALPHABET.charCodeAt(i);
    DECODE[lowerCharCode] = i;
}
/**
 * @spec 0031: Character repair: `I`/`i`/`L`/`l` -> `1`, `O`/`o` -> `0`.
 * @spec 0032: Character U: `U`/`u` is never repaired; rejected as `INVALID_CHARACTER`.
 */
for (const c of 'IiLl') {
    DECODE[c.charCodeAt(0)] = 1;
}
for (const c of 'Oo') {
    DECODE[c.charCodeAt(0)] = 0;
}

/**
 * @spec 0006: Check value: 10 bits, weighted sum Σ(val_i * (i + 1)) (i = 0..17) mod 1024.
 * @spec 0050: Error detection: catches every single-character substitution and every swap of two different payload characters; a random 20-character string passes with probability 1/1024.
 */
function checkValue(sum: number): number {
    return sum & 0x3ff;
}

// -------------------------------------------------------------------
// 3. Exported Functions
// -------------------------------------------------------------------

/**
 * **Generates a random 20-character identifier with a valid checksum.**
 *
 * @spec 0017: Entropy source: `generate()` synchronously draws 18 bytes from `globalThis.crypto.getRandomValues` (CSPRNG).
 * @spec 0045: Random value mapping: each random byte keeps its low 5 bits (`byte & 31`, value 0-31) as one character; 256 is a multiple of 32, so all characters are equally likely.
 * @spec 0018: Throw contract: only `generate()` and `generateFormatted()` throw, a `TypeError` when Web Crypto is missing (no insecure fallback); all other exports never throw.
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
 * Never throws; safe against non-`Uint8Array` and too short inputs.
 *
 * @spec 0021: Determinism: identical byte input yields identical `SID`.
 * @spec 0022: No hashing: bytes are used as-is; callers hash first (e.g. SHA-256) for uniformly distributed IDs.
 *
 * @param bytes - At least 12 bytes (`Buffer` accepted).
 * @returns Canonical 20-character unhyphenated `SID`, or `null` if `bytes` is not a `Uint8Array` or shorter than 12 bytes.
 */
export function fromBytes(bytes: Uint8Array): SID | null {
    /**
     * @spec 0023: Input type: any `Uint8Array`, including Node.js/Bun `Buffer` and instances from other realms (`node:vm`, iframes); other values (other typed arrays, `ArrayBuffer`, `DataView`, plain arrays) return `null`.
     * @spec 0024: Exotic input: revoked Proxy returns `null` (`isView` checked before the typed-array brand check, where `instanceof` would throw); detached buffer has length 0 and returns `null`.
     */
    if (
        !ArrayBuffer.isView(bytes) ||
        (!(bytes instanceof Uint8Array) && typedArrayName?.call(bytes) !== 'Uint8Array') ||
        bytes.length < MIN_BYTES
    ) {
        return null;
    }

    /**
     * @spec 0025: Payload extraction: bytes are read as one bit stream, most significant bit first; each consecutive 5 bits form one character value (bits 0-4 -> character 0, bits 5-9 -> character 1, ...).
     * @spec 0047: Trailing data: only the first 90 bits are used (bytes 0-10 and the top 2 bits of byte 11); everything after is ignored.
     */
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
 * @spec 0020: `generateFormatted()`: formats `generate()` output to `XXXX-XXXX-XXXX-XXXX-XXXX`.
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
 * @spec 0038: `verify()`: returns `parse(input).ok`.
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
 * @spec 0041: `isSID()`: type guard narrowing to `SID`; `true` only for input that is already canonical (no trimming, case folding, repair, or hyphens, unlike `verify()`).
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
 * @spec 0042: `isFormattedSID()`: type guard narrowing to `FormattedSID`; `true` only for input that is already canonical and hyphenated (no trimming, case folding, or repair, unlike `verify()`).
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
 * @spec 0033: Error precedence: `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, then one left-to-right pass reporting the first `INVALID_CHARACTER` or `CHECKSUM_MISMATCH`.
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
        /**
         * @spec 0034: Alphabet validation: non-Crockford character (including non-ASCII) returns `INVALID_CHARACTER`.
         * @spec 0035: Diagnostic character: `INVALID_CHARACTER` error names the offending character as a full code point.
         * @spec 0049: Diagnostic index: `INVALID_CHARACTER` error reports the 0-based UTF-16 index in the trimmed input, hyphens included.
         */
        if (val === -1) {
            const index = trimmed.length === FORMATTED_LENGTH ? i + Math.floor(i / 4) : i;
            const char = String.fromCodePoint(trimmed.codePointAt(index) ?? 0);
            return {
                ok: false,
                code: 'INVALID_CHARACTER',
                error: `Invalid ID ${JSON.stringify(trimmed)} contains invalid character ${JSON.stringify(char)} at index ${index}`,
            };
        }
        /** @spec 0036: Checksum validation: check characters must match the computed check value; otherwise `CHECKSUM_MISMATCH`. */
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

    /**
     * @spec 0037: Parse success: returns `{ ok: true, data: SID }` with canonical 20-character `SID`.
     * @spec 0048: Canonical case: output is strictly uppercase, whatever the input case.
     */
    return { ok: true, data: canonical as SID };
}

/**
 * **Formats an identifier into quad groups `XXXX-XXXX-XXXX-XXXX-XXXX`.**
 *
 * Never throws; safe against non-string and malformed inputs.
 *
 * @spec 0039: `format()` success: returns `{ ok: true, data: FormattedSID }` for all `parse()`-valid inputs.
 * @spec 0040: `format()` failure: propagates `parse()` error result unchanged.
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
    /** @spec 0007: Checksum encoding: 2 alphabet characters (high 5 bits first, low 5 bits second). */
    return (payload + (CROCKFORD_ALPHABET[(check >> 5) & 31] ?? '') + (CROCKFORD_ALPHABET[check & 31] ?? '')) as SID;
}

/**
 * **Normalizes raw input into canonical 20-character format.**
 *
 * Does not change case, repair ambiguous characters, or validate alphabet membership and checksum;
 * `parse()` does all of that in a single pass over the ASCII decode table.
 *
 * @param input - Raw input to normalize.
 * @returns Cleaned 20-character string alongside trimmed input on success, or an error result.
 */
function normalize(input: unknown): SidResult<{ trimmed: string; clean: string }> {
    /** @spec 0026: Input type: accepts `unknown`; non-string returns `NOT_A_STRING`. */
    if (typeof input !== 'string') {
        return {
            ok: false,
            code: 'NOT_A_STRING',
            error: `Expected string input, received ${input === null ? 'null' : typeof input}`,
        };
    }

    /** @spec 0027: Whitespace: `String.prototype.trim()` removes leading/trailing whitespace and line breaks, incl. NBSP and BOM; zero-width characters (e.g. U+200B) are not trimmed. */
    const trimmed = input.trim();

    if (trimmed.length === TOTAL_LENGTH) {
        return { ok: true, data: { trimmed, clean: trimmed } };
    }

    /** @spec 0029: Hyphen validation: 24-character input needs hyphens exactly at indices 4, 9, 14, 19 and nowhere else; otherwise `INVALID_FORMAT`. */
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

    /** @spec 0028: Length check: trimmed length must be 20 (raw) or 24 (formatted); otherwise `INVALID_LENGTH`. */
    return {
        ok: false,
        code: 'INVALID_LENGTH',
        error: `Invalid ID length: expected 20 (raw) or 24 (XXXX-XXXX-XXXX-XXXX-XXXX) characters, got ${trimmed.length}`,
    };
}
