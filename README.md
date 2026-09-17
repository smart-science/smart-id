# SID (smart-id)

Fast 16-character canonical identifier: generator, parser, formatter, and checksum verifier for TypeScript and JavaScript.

---

## Installation

```bash
# bun
bun add @smart-science/sid

# npm
npm install @smart-science/sid
```

---

## Overview

* **`generate()`**: Generates a random canonical 16-character `SID` (15 payload characters + 1 check character).
* **`generateFormatted()`**: Generates a random 19-character `FormattedSID` (`XXXX-XXXX-XXXX-XXXX`).
* **`verify(input)`**: Lenient check for raw or formatted input; returns `boolean`.
* **`isSID(input)`**: Strict type guard for an exact canonical 16-character `SID`.
* **`isFormattedSID(input)`**: Strict type guard for an exact canonical 19-character `FormattedSID`.
* **`parse(input)`**: Normalizes, repairs ambiguous characters, and validates into `SidResult<SID>`.
* **`format(input)`**: Validates raw or formatted input and returns `SidResult<FormattedSID>`.

Only `generate()` and `generateFormatted()` can throw (see [Functions](#functions)). All other functions accept any value and never throw.

---

## Usage

```ts
import { format, generate, generateFormatted, isSID, parse, verify } from '@smart-science/sid';

// 1. Generation
const id = generate(); // e.g. '0123456789ABCDE7'
const formatted = generateFormatted(); // e.g. '0123-4567-89AB-CDE7'

// 2. Lenient verification vs. strict type guards
verify(id); // true
verify('  oi23-4567-89ab-cde7  '); // true (accepts whitespace, hyphens, lowercase, and repairs)
isSID('  oi23-4567-89ab-cde7  '); // false (requires the exact canonical form)
isSID(id); // true (narrows the type to SID)

// 3. Parsing & repair (whitespace, lowercase, ambiguous characters 'I', 'L', 'O')
const res = parse('  oI23-4567-89ab-cde7  ');
if (res.ok) {
    console.log(res.data); // '0123456789ABCDE7'
} else {
    console.error(res.code, res.error);
}

// 4. Formatting
const formattedResult = format(id); // { ok: true, data: '0123-4567-89AB-CDE7' }
```

> **Rule of thumb:** store, compare, and name files with the canonical `parse(input).data`.

---

## Lenient `verify()` vs. Strict Type Guards

* **`verify(input: unknown): boolean`** (lenient)
  Accepts raw 16-character IDs and 19-character quad-grouped IDs (`XXXX-XXXX-XXXX-XXXX`). Trims surrounding whitespace, accepts lowercase, and repairs ambiguous characters (`I`, `i`, `L`, `l` → `1`; `O`, `o` → `0`). Use it for tolerant user input.

* **`isSID(input: unknown): input is SID`** (strict)
  Returns `true` only for an exact, unhyphenated, uppercase 16-character `SID` with a valid checksum, and narrows `input` to `SID`. Whitespace, hyphens, lowercase, and unrepaired ambiguous characters return `false`.

* **`isFormattedSID(input: unknown): input is FormattedSID`** (strict)
  Returns `true` only for an exact, uppercase 19-character `FormattedSID` with a valid checksum, and narrows `input` to `FormattedSID`.

---

## Return Format: `SidResult<T>`

`parse()` and `format()` return a discriminated union:

```ts
export type SidResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly code: SidErrorCode; readonly error: string };

export type SidErrorCode =
    | 'NOT_A_STRING'
    | 'INVALID_LENGTH'
    | 'INVALID_FORMAT'
    | 'INVALID_CHARACTER'
    | 'CHECKSUM_MISMATCH';
```

Branch on `code`; `error` is a human-readable diagnostic message.

| Code | Returned when |
|---|---|
| `NOT_A_STRING` | The input is not a primitive string (e.g. `null`, `undefined`, number, object) |
| `INVALID_LENGTH` | The trimmed length is neither 16 (raw) nor 19 (formatted) |
| `INVALID_FORMAT` | The input has 19 characters but hyphens are not at indices 4, 9, 14 (`XXXX-XXXX-XXXX-XXXX`) |
| `INVALID_CHARACTER` | A character is not in Crockford Base32 (upper- or lowercase) and is not a repairable I, L, or O; the message names the character and its index in the trimmed input |
| `CHECKSUM_MISMATCH` | The check character does not match the modulo-32 checksum |

---

## Algorithm Specification

1. **Length:** 16 characters: 15 random payload characters followed by 1 check character.
2. **Alphabet:** Crockford Base32; each character's value is its index (0–31):
   ```text
   0 1 2 3 4 5 6 7 8 9 A B C D E F G H J K M N P Q R S T V W X Y Z
   ```
   `I`, `L`, and `O` are excluded to avoid visual ambiguity, and `U` to avoid accidental obscenities.
3. **Normalization (lenient input only):**
   * Surrounding whitespace is trimmed.
   * Lowercase letters are accepted.
   * `I`, `i`, `L`, `l` → `1` and `O`, `o` → `0`.
   * `U` and `u` are invalid.
4. **Formatted form:** 19 characters with hyphens at 0-based indices 4, 9, and 14:
   ```text
   XXXX-XXXX-XXXX-XXXX
   ```
5. **Checksum (modulo 32):**
   * Weights alternate over all 16 positions, starting with 1 at index 0:
     ```text
     index:   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
     weight:  1 3 1 3 1 3 1 3 1 3  1  3  1  3  1  3
     ```
   * The check character (index 15) makes the weighted sum of all 16 values divisible by 32:
     ```text
     (weight[0] * value[0] + ... + weight[15] * value[15]) mod 32 = 0
     ```
   * With `S` as the weighted sum of indices 0–14, and because `3 * 11 = 33 ≡ 1 (mod 32)`:
     ```text
     check = ((32 - S mod 32) * 11) mod 32
     ```

---

## Error Detection

* **One wrong character** is always detected.
* **Two swapped characters at positions with different weights** (for example two neighbouring characters, including the last payload character and the check character) are detected, unless their values differ by exactly 16 (for example `0` and `G`). Such a swap changes the sum by `2 * 16 = 32`, which is invisible modulo 32.
* **Two swapped characters at positions with the same weight** (for example positions `i` and `i + 2`) are not detected.

---

## Runtime Support

| Runtime | Versions | Notes |
|---|---|---|
| **Node.js** | 20.19+ on 20.x, or 22.12 and later | ESM `import` and CommonJS `require()` |
| **Bun** | 1.3 and later | Uses the TypeScript source via the `bun` export condition |
| **Deno** | Current | Via the `npm:` specifier |
| **Browsers** | Current evergreen browsers | Requires Web Crypto |

---

## Functions

### `generate(): SID`
* Generates 15 random Crockford Base32 characters with `globalThis.crypto.getRandomValues` and appends the check character.
* **Returns**: canonical 16-character `SID`.
* **Throws**: `TypeError` if the runtime has no global Web Crypto (for example Node.js 18 and older).

### `generateFormatted(): FormattedSID`
* Generates a canonical `SID` and groups it as `XXXX-XXXX-XXXX-XXXX`.
* **Returns**: 19-character `FormattedSID`.
* **Throws**: `TypeError` if the runtime has no global Web Crypto (for example Node.js 18 and older).

### `verify(input: unknown): boolean`
* Leniently checks length, format, alphabet, and checksum.
* **Returns**: `true` if valid, else `false`. Never throws.

### `isSID(input: unknown): input is SID`
* Strict type guard for an exact canonical 16-character `SID`.
* **Returns**: `true` if `input` is an exact canonical `SID`, else `false`. Never throws.

### `isFormattedSID(input: unknown): input is FormattedSID`
* Strict type guard for an exact canonical 19-character `FormattedSID`.
* **Returns**: `true` if `input` is an exact canonical `FormattedSID`, else `false`. Never throws.

### `parse(input: unknown): SidResult<SID>`
* Trims whitespace, strips hyphens from the formatted form, repairs ambiguous characters, and validates alphabet and checksum.
* **Returns**: `{ ok: true, data: SID }` or `{ ok: false, code: SidErrorCode, error: string }`. Never throws.

### `format(input: unknown): SidResult<FormattedSID>`
* Parses and validates raw or formatted input and groups it as `XXXX-XXXX-XXXX-XXXX`.
* **Returns**: `{ ok: true, data: FormattedSID }` or `{ ok: false, code: SidErrorCode, error: string }`. Never throws.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

[Apache-2.0](LICENSE)
