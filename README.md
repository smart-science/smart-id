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

* **`generate()`**: Generates random 16-character (15+1) canonical `SID`.
* **`generateFormatted()`**: Generates formatted 19-character `FormattedSID` (`XXXX-XXXX-XXXX-XXXX`).
* **`verify(input)`**: Validates length, alphabet, and checksum without throwing (`boolean`).
* **`parse(input)`**: Normalizes, repairs ambiguous characters, and validates into `Result<SID>`.
* **`format(input)`**: Validates and formats raw or formatted input into `Result<FormattedSID>`.
* **`unformat(id)`**: Zero-overhead $O(1)$ hyphen stripping for pre-validated `FormattedSID`.

---

## Usage

```ts
import { format, generate, generateFormatted, parse, unformat, verify } from '@smart-science/sid';

// 1. Generation
const id = generate(); // '0123456789ABCDEN'
const formatted = generateFormatted(); // '0123-4567-89AB-CDEN'

// 2. Verification
verify(id); // true
verify('INVALID-ID'); // false

// 3. Parsing & Repair (whitespace, lowercase, ambiguous characters 'I', 'L', 'O')
const res = parse('  oI23-4567-89ab-cden  ');
if (res.ok) {
    console.log(res.data); // '0123456789ABCDEN'
} else {
    console.error(res.error);
}

// 4. Formatting & Unformatting
const formattedResult = format(id); // { ok: true, data: '0123-4567-89AB-CDEN' }
if (formattedResult.ok) {
    const canonical = unformat(formattedResult.data); // '0123456789ABCDEN'
}
```

---

## Return Format: `Result<T>`

Non-throwing operations return a strict discriminated union:
* **Success**: `{ ok: true, data: T }`
* **Failure**: `{ ok: false, error: string }`

---

## Crockford Base32 Normalization

Uses Crockford Base32 (`0-9`, `A-Z` excluding `I`, `L`, `O`, `U`) with Modulo-32 alternating-weight ($1, 3$) checksum:
* **Ambiguity Repair**:
    * `i`, `I`, `l`, `L` $\to$ `1`
    * `o`, `O` $\to$ `0`
* **Excluded**: `u`, `U` (invalid character).
* **Separators**: Hyphens permitted only at quad positions (`4, 9, 14`).

---

## Functions

### `generate(): SID`

* Uses `globalThis.crypto.getRandomValues` for 15 random characters.
* Computes and appends Modulo-32 check character.
* **Returns**: 16-character unhyphenated `SID` string.
* **Throws**: `TypeError` if runtime environment lacks Crypto (`globalThis.crypto.getRandomValues`).

### `generateFormatted(): FormattedSID`

* Generates canonical `SID` and groups into `XXXX-XXXX-XXXX-XXXX` pattern.
* **Returns**: 19-character hyphenated `FormattedSID` string.

### `verify(input: unknown): boolean`

* Validates length (16-char raw or 19-char formatted), alphabet, and checksum.
* Safe against non-string and malformed inputs.
* **Returns**: `true` if valid, else `false`.

### `parse(input: unknown): Result<SID>`

* Trims whitespace and normalizes lowercase characters to uppercase.
* Converts ambiguous characters.
* Strips hyphens from valid 19-character quad format.
* Verifies alphabet and Modulo-32 checksum.
* **Returns**: `Result<SID>` (`{ ok: true, data: SID }` or `{ ok: false, error: string }`).

### `format(input: unknown): Result<FormattedSID>`

* Parses and validates raw or formatted input.
* Formats canonical string into quad group `XXXX-XXXX-XXXX-XXXX`.
* **Returns**: `Result<FormattedSID>` (`{ ok: true, data: FormattedSID }` or `{ ok: false, error: string }`).

### `unformat(id: FormattedSID): SID`

* Assumes input was already parsed and validated; for unvalidated input, use `parse()` before.
* Strips hyphens at fixed indices (`4, 9, 14`) via direct string slicing.
* Zero runtime regex or validation overhead for pre-validated `FormattedSID`.
* **Returns**: Canonical 16-character `SID`.
* **Throws**: `TypeError` in untyped JavaScript if `id` is not a string (e.g. `null` or `undefined`).
