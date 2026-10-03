# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `fromBytes(bytes)` derives a deterministic `SID` from the first 90 bits of a `Uint8Array` (e.g. a SHA-256 digest). Returns `null` for fewer than 12 bytes or non-`Uint8Array` input; never throws.
- `CROCKFORD_ALPHABET` exports the 32-character alphabet in value order.

### Changed

- **BREAKING**: IDs have 20 characters (18 random + 2 check characters, 90 bits of randomness) instead of 16. The hyphenated form has five groups: `XXXX-XXXX-XXXX-XXXX-XXXX` (24 characters).
- **BREAKING**: The check is a weighted sum modulo 1024 (`Σ value × position`, positions 1 to 18) written as two characters. Every single wrong character and every swap of two characters is detected; random input passes with a probability of 1 in 1024. IDs created with 0.2.x no longer verify.
- **BREAKING**: `FormattedSID` is a five-group template literal type.
- `INVALID_LENGTH` and `INVALID_FORMAT` messages name the new lengths (20 or 24) and hyphen positions (4, 9, 14, 19).

## [0.2.0] - 2026-09-18

### Added

- Machine-readable `code` (`SidErrorCode`) on every failure result: `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, `INVALID_CHARACTER`, or `CHECKSUM_MISMATCH`.
- Releases are published to npm through trusted publishing (OIDC, no npm token) with provenance.
- README documents each function with examples, the error codes, TypeScript types, how IDs work (alphabet, input repair, check character), and runtime support.

### Changed

- License changed from `UNLICENSED` to `Apache-2.0`.
- **BREAKING**: `SID` and `FormattedSID` are branded with string-literal types; the runtime exports `SidBrand` and `FormattedSidBrand` are removed.
- **BREAKING**: `Result<T>` is renamed to `SidResult<T>`.
- Error messages reworded: `null` input is reported as `null`, both valid lengths are named, hyphen positions are marked as 0-based, input is quoted as trimmed (with hyphens), and `INVALID_CHARACTER` names the offending character and its index. Branch on `code` instead of matching `error`.
- `generate()` and `generateFormatted()` throw a `TypeError` that names the missing Web Crypto API instead of the runtime's generic property-access error.
- **BREAKING**: The check character continues the alternating 1/3 weights (weight 3), so swapping the last two characters is now detected. IDs created with 0.1.x may no longer verify.

### Removed

- **BREAKING**: `unformat()`; use `parse()` instead.

## [0.1.1] - 2026-09-16

Tagged in git only; not published to npm.

### Added

- `isSID()` and `isFormattedSID()` strict type guards.
- `bun` export condition that serves the TypeScript source to Bun.

### Changed

- Build output is no longer minified, and `src/` is published so declaration maps resolve.

### Deprecated

- `unformat()`; use `parse()` instead.

### Fixed

- `require('@smart-science/sid')` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`; it now works on Node.js 20.19 and later.
- `verify()` and `parse()` accepted some non-ASCII input (`ß`, `ı`, `ſ`, `ﬁ`) through Unicode case mapping.

## [0.1.0] - 2026-08-30

### Added

- Initial release with `generate()`, `generateFormatted()`, `verify()`, `parse()`, `format()`, and `unformat()`.
- Crockford Base32 identifier generation with a Modulo-32 alternating-weight checksum.

[Unreleased]: https://github.com/smart-science/smart-id/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/smart-science/smart-id/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/smart-science/smart-id/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/smart-science/smart-id/releases/tag/v0.1.0
