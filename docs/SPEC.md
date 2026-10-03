# SID Specification

Decided behavior and non-obvious details of `@smart-science/sid`. Referenced in code as `@spec NNNN`.

## 1. Identifier Format

- 🔴 @spec 0001: Length: 20 characters (18 payload characters, 2 check characters).
- 🔴 @spec 0002: Alphabet: Crockford Base32 `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (excludes I, L, O, U).
- 🔴 @spec 0043: Export: alphabet exported as `CROCKFORD_ALPHABET`; character index = 5-bit value.
- 🔴 @spec 0003: Bit capacity: 5 bits per character; 18-character payload = 90 bits.
- 🔴 @spec 0004: Canonical form: uppercase, unhyphenated, no whitespace.
- 🔴 @spec 0005: Formatted layout: 24 characters `XXXX-XXXX-XXXX-XXXX-XXXX` (hyphens at 0-based indices 4, 9, 14, 19).

## 2. Checksum

- 🔴 @spec 0006: Check value: 10 bits, weighted sum Σ(val_i * (i + 1)) (i = 0..17) mod 1024.
- 🔴 @spec 0007: Checksum encoding: 2 alphabet characters (high 5 bits first, low 5 bits second).
- 🔴 @spec 0050: Error detection: catches every single-character substitution and every swap of two different payload characters; a random 20-character string passes with probability 1/1024.

## 3. Types

- 🔴 @spec 0008: Branding: `SID` and `FormattedSID` are compile-time branded strings; plain strings at runtime.
- 🔴 @spec 0009: Brand key: `__sidBrand` exists only in the type; runtime values have no such property.
- 🔴 @spec 0010: `FormattedSID` type: template literal `${string}-${string}-${string}-${string}-${string}` plus brand.
- 🔴 @spec 0011: `SID` producers: `generate()`, `fromBytes()`, `parse()`, `isSID()`.
- 🔴 @spec 0012: `FormattedSID` producers: `generateFormatted()`, `format()`, `isFormattedSID()`.

## 4. Results & Errors

- 🔴 @spec 0018: Throw contract: only `generate()` and `generateFormatted()` throw, a `TypeError` when Web Crypto is missing (no insecure fallback); all other exports never throw.
- 🔴 @spec 0013: Result type: `parse()` and `format()` return `SidResult<T>`, a union discriminated by `ok`.
- 🔴 @spec 0016: Immutability: `SidResult` properties are readonly.
- 🔴 @spec 0015: Error codes: `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, `INVALID_CHARACTER`, `CHECKSUM_MISMATCH`.
- 🔴 @spec 0014: Error code: `code` is the stable contract; branch on it.
- 🔴 @spec 0044: Error message: `error` is diagnostic only; wording may change between versions.

## 5. Generation

- 🔴 @spec 0017: Entropy source: `generate()` synchronously draws 18 bytes from `globalThis.crypto.getRandomValues` (CSPRNG).
- 🔴 @spec 0045: Random value mapping: each random byte keeps its low 5 bits (`byte & 31`, value 0-31) as one character; 256 is a multiple of 32, so all characters are equally likely.
- 🔴 @spec 0020: `generateFormatted()`: formats `generate()` output to `XXXX-XXXX-XXXX-XXXX-XXXX`.

## 6. Deterministic Derivation (`fromBytes`)

- 🔴 @spec 0021: Determinism: identical byte input yields identical `SID`.
- 🔴 @spec 0022: No hashing: bytes are used as-is; callers hash first (e.g. SHA-256) for uniformly distributed IDs.
- 🔴 @spec 0023: Input type: any `Uint8Array`, including Node.js/Bun `Buffer` and instances from other realms (`node:vm`, iframes); other values (other typed arrays, `ArrayBuffer`, `DataView`, plain arrays) return `null`.
- 🔴 @spec 0046: Input length: `fromBytes()` requires >= 12 bytes (90 bits rounded up); shorter input returns `null`.
- 🔴 @spec 0024: Exotic input: revoked Proxy returns `null` (`isView` checked before the typed-array brand check, where `instanceof` would throw); detached buffer has length 0 and returns `null`.
- 🔴 @spec 0025: Payload extraction: bytes are read as one bit stream, most significant bit first; each consecutive 5 bits form one character value (bits 0-4 -> character 0, bits 5-9 -> character 1, ...).
- 🔴 @spec 0047: Trailing data: only the first 90 bits are used (bytes 0-10 and the top 2 bits of byte 11); everything after is ignored.

## 7. Parsing

### 7.1 Normalization

- 🔴 @spec 0026: Input type: accepts `unknown`; non-string returns `NOT_A_STRING`.
- 🔴 @spec 0027: Whitespace: `String.prototype.trim()` removes leading/trailing whitespace and line breaks, incl. NBSP and BOM; zero-width characters (e.g. U+200B) are not trimmed.
- 🔴 @spec 0028: Length check: trimmed length must be 20 (raw) or 24 (formatted); otherwise `INVALID_LENGTH`.
- 🔴 @spec 0029: Hyphen validation: 24-character input needs hyphens exactly at indices 4, 9, 14, 19 and nowhere else; otherwise `INVALID_FORMAT`.

### 7.2 Character Decoding

- 🔴 @spec 0030: Case tolerance: input decoding is case-insensitive.
- 🔴 @spec 0031: Character repair: `I`/`i`/`L`/`l` -> `1`, `O`/`o` -> `0`.
- 🔴 @spec 0032: Character U: `U`/`u` is never repaired; rejected as `INVALID_CHARACTER`.

### 7.3 Validation

- 🔴 @spec 0033: Error precedence: `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, then one left-to-right pass reporting the first `INVALID_CHARACTER` or `CHECKSUM_MISMATCH`.
- 🔴 @spec 0034: Alphabet validation: non-Crockford character (including non-ASCII) returns `INVALID_CHARACTER`.
- 🔴 @spec 0035: Diagnostic character: `INVALID_CHARACTER` error names the offending character as a full code point.
- 🔴 @spec 0049: Diagnostic index: `INVALID_CHARACTER` error reports the 0-based UTF-16 index in the trimmed input, hyphens included.
- 🔴 @spec 0036: Checksum validation: check characters must match the computed check value; otherwise `CHECKSUM_MISMATCH`.
- 🔴 @spec 0037: Parse success: returns `{ ok: true, data: SID }` with canonical 20-character `SID`.
- 🔴 @spec 0048: Canonical case: output is strictly uppercase, whatever the input case.

## 8. Verification & Formatting

- 🔴 @spec 0038: `verify()`: returns `parse(input).ok`.
- 🔴 @spec 0039: `format()` success: returns `{ ok: true, data: FormattedSID }` for all `parse()`-valid inputs.
- 🔴 @spec 0040: `format()` failure: propagates `parse()` error result unchanged.

## 9. Type Guards

- 🔴 @spec 0041: `isSID()`: type guard narrowing to `SID`; `true` only for input that is already canonical (no trimming, case folding, repair, or hyphens, unlike `verify()`).
- 🔴 @spec 0042: `isFormattedSID()`: type guard narrowing to `FormattedSID`; `true` only for input that is already canonical and hyphenated (no trimming, case folding, or repair, unlike `verify()`).
