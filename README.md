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
* **`parse(input)`**: Normalizes, repairs ambiguous characters, and validates into `SidResult<SID>`.
* **`format(input)`**: Validates and formats raw or formatted input into `SidResult<FormattedSID>`.

---

## Usage

```ts
import { format, generate, generateFormatted, parse, verify } from '@smart-science/sid';

// 1. Generation
const id = generate(); // '0123456789ABCDE7'
const formatted = generateFormatted(); // '0123-4567-89AB-CDE7'

// 2. Verification
verify(id); // true
verify('INVALID-ID'); // false

// 3. Parsing & Repair (whitespace, lowercase, ambiguous characters 'I', 'L', 'O')
const res = parse('  oI23-4567-89ab-cde7  ');
if (res.ok) {
    console.log(res.data); // '0123456789ABCDE7'
} else {
    console.error(res.code, res.error);
}

// 4. Formatting
const formattedResult = format(id); // { ok: true, data: '0123-4567-89AB-CDE7' }

// 5. Back to canonical form
const canonical = parse('0123-4567-89AB-CDE7'); // { ok: true, data: '0123456789ABCDE7' }
```

---

## Return Format: `SidResult<T>`

Non-throwing operations return a strict discriminated union:
* **Success**: `{ ok: true, data: T }`
* **Failure**: `{ ok: false, code: SidErrorCode, error: string }`

`SidErrorCode` is one of `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, `INVALID_CHARACTER`, or `CHECKSUM_MISMATCH`. Branch on `code`; `error` is a human-readable message.

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

### `parse(input: unknown): SidResult<SID>`

* Trims whitespace and normalizes lowercase characters to uppercase.
* Converts ambiguous characters.
* Strips hyphens from valid 19-character quad format.
* Verifies alphabet and Modulo-32 checksum.
* **Returns**: `SidResult<SID>` (`{ ok: true, data: SID }` or `{ ok: false, code: SidErrorCode, error: string }`).

### `format(input: unknown): SidResult<FormattedSID>`

* Parses and validates raw or formatted input.
* Formats canonical string into quad group `XXXX-XXXX-XXXX-XXXX`.
* **Returns**: `SidResult<FormattedSID>` (`{ ok: true, data: FormattedSID }` or `{ ok: false, code: SidErrorCode, error: string }`).

---

## License

[Apache-2.0](LICENSE)
