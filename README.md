# SID (smart-id)

Fast 16-character identifiers with a check character: generate, parse, format, and verify. For TypeScript and JavaScript, with no dependencies.

---

## Installation

```bash
# bun
bun add @smart-science/sid

# npm
npm install @smart-science/sid
```

---

## Usage

```ts
import { format, generate, generateFormatted, isFormattedSID, isSID, parse, verify } from '@smart-science/sid';
```

### Create an ID: `generate()` and `generateFormatted()`

```ts
const id = generate(); // '0123456789ABCDE7'
const pretty = generateFormatted(); // '0123-4567-89AB-CDE7'
```

- `generate()` returns a new random 16-character ID, typed `SID`.
- `generateFormatted()` returns the same kind of ID grouped for reading, typed `FormattedSID`.

Both throw a `TypeError` if the runtime has no Web Crypto (which every supported runtime has).

### Read an ID: `parse(input)`

Use `parse()` whenever an ID comes from outside. It accepts both forms, cleans up the input, and returns the canonical 16-character ID:

```ts
parse('0123-4567-89AB-CDE7'); // { ok: true, data: '0123456789ABCDE7' }
parse(' oi23-4567-89ab-cde7 '); // { ok: true, data: '0123456789ABCDE7' } (see "Self-repairing input")
parse('0123-4567-89AB-CDE8'); // { ok: false, code: 'CHECKSUM_MISMATCH', error: '...' }
```

The result is either `{ ok: true, data }` or `{ ok: false, code, error }`. Check `ok` first:

```ts
const res = parse(input);
if (res.ok) {
    console.log(res.data); // res.data is type SID
} else {
    console.error(res.code); // e.g. 'CHECKSUM_MISMATCH'; see "Error codes"
}
```

Always store and compare the canonical `res.data`, never the raw input.

### Display an ID: `format(input)`

Works like `parse()`, but returns the hyphenated form `XXXX-XXXX-XXXX-XXXX`, typed `FormattedSID`:

```ts
format('0123456789ABCDE7'); // { ok: true, data: '0123-4567-89AB-CDE7' }
format('0123456789abcde7'); // { ok: true, data: '0123-4567-89AB-CDE7' }
format('not an id'); // { ok: false, code: 'INVALID_LENGTH', error: '...' }
```

### Just check: `verify(input)`

Returns `true` or `false`. It accepts the same forgiving input as `parse()`:

```ts
verify('0123-4567-89ab-cde7'); // true
verify('0123-4567-89AB-CDE8'); // false (wrong check character)
```

Use `parse()` instead if you want to keep the ID, because `verify()` doesn't return the cleaned-up form.

### Strict checks: `isSID(input)` and `isFormattedSID(input)`

Return `true` only when the input is already exactly in canonical form: uppercase, no extra spaces, no repaired characters. They are useful for checking data you store yourself:

```ts
isSID('0123456789ABCDE7'); // true
isSID('0123456789abcde7'); // false (valid, but not canonical: use parse())
isFormattedSID('0123-4567-89AB-CDE7'); // true
isFormattedSID('0123456789ABCDE7'); // false (not hyphenated)
```

In TypeScript, a `true` result also narrows the value's type to `SID` or `FormattedSID`.

```ts
declare const input: unknown;

if (isSID(input)) {
    const typed: SID = input; // typed SID
} else if (isFormattedSID(input)) {
    const typed: FormattedSID = input; // typed FormattedSID
}
```

All functions that take input accept any value, including `null`, numbers, and objects. They never throw; invalid input is simply rejected.

---

## Error codes

`parse()` and `format()` report why an input was rejected. Branch on `code`. `error` is a human-readable message whose wording may change.

```ts
{
    ok: false;
    code: SidErrorCode;
    error: string;
}
```

| `code` | Meaning |
|---|---|
| `NOT_A_STRING` | The input is not a string |
| `INVALID_LENGTH` | Too short or too long for an ID |
| `INVALID_FORMAT` | The right length for the hyphenated form, but the hyphens are in the wrong places |
| `INVALID_CHARACTER` | Contains a character that can't appear in an ID; `error` names it |
| `CHECKSUM_MISMATCH` | All characters are allowed, but the check character doesn't match: most likely a typo |

---

## TypeScript types

```ts
import type { FormattedSID, SID, SidErrorCode, SidResult } from '@smart-science/sid';
```

`SID` and `FormattedSID` are strings at runtime. In TypeScript they are kept apart from plain `string`; an unchecked string can't be passed where a typed ID is expected:

```ts
function load(id: SID) { /* ... */ }

declare const input: string;
load(input); // compile error: plain string is not a SID

const res = parse(input);
if (res.ok) load(res.data); // OK: validated by parse()
if (isSID(input)) load(input); // OK: validated by isSID()
load(input as SID); // OK: a cast, unsafe if unchecked
```

---

## How IDs work

### Characters

An ID has 16 characters drawn from 32 symbols (Crockford's Base32): digits `0`–`9` and letters `A`–`Z` **without `I`, `L`, `O`, and `U`**. Left out because easily confused with `1` and `0` (and `U` to avoid *accidental* words).

First 15 characters are random, which gives about 3.8 × 10²² possible IDs. Two randomly generated IDs are practically never the same. The 16th character is a **check character** computed from the other 15.

### Self-repairing input

- lowercase letters are accepted: `abc` → `ABC`
- `I` and `L` converted to `1`, and `O` to `0`
- surrounding spaces are ignored
- the hyphenated and plain forms are both accepted

### What the check character catches

- **Any single wrong character** is always detected.
- **Two neighboring characters swapped** (`…AB…` typed as `…BA…`) is detected, except for a few rare character pairs such as `0` and `G`.
- **Not detected:** swaps of characters that are two positions apart, and some combinations of several errors. The check guards against typos. It is not a guarantee that random input can never pass.

### What an ID does not do

- It contains no date and has no order.
- It is not secret and proves nothing about who created it.

---

## Runtime support

| Runtime | Versions |
|---|---|
| **Node.js** | 20.19+ on 20.x, or 22.12 and later (`import` and `require()`) |
| **Bun** | 1.3 and later |
| **Deno** | Current, via `npm:@smart-science/sid` |
| **Browsers** | Current evergreen browsers |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[Apache-2.0](LICENSE)
