# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Machine-readable `code` (`SidErrorCode`) on every failure result: `NOT_A_STRING`, `INVALID_LENGTH`, `INVALID_FORMAT`, `INVALID_CHARACTER`, or `CHECKSUM_MISMATCH`.
- Releases are published to npm with provenance.
- README documents each function with examples, the error codes, TypeScript types, how IDs work (alphabet, input repair, check character), and runtime support.

### Changed

- License changed from `UNLICENSED` to `Apache-2.0`.
- **BREAKING**: `SID` and `FormattedSID` are branded with string-literal types; the runtime exports `SidBrand` and `FormattedSidBrand` are removed.
- **BREAKING**: `Result<T>` is renamed to `SidResult<T>`.
- Error messages reworded: `null` input is reported as `null`, both valid lengths are named, hyphen positions are marked as 0-based, input is quoted as trimmed (with hyphens), and `INVALID_CHARACTER` names the offending character and its index. Branch on `code` instead of matching `error`.
- `generate()` and `generateFormatted()` throw a `TypeError` that names the missing Web Crypto API instead of the runtime's generic property-access error.
- `engines.node` narrowed to `^20.19.0 || >=22.12.0`, where `require()` of the package works; `engines.bun` raised to `>=1.3.0`.
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
- `engines.node` corrected to `>=20.19.0`, because Node.js 18 has no global Web Crypto.

## [0.1.0] - 2026-08-30

### Added

- Initial release with `generate()`, `generateFormatted()`, `verify()`, `parse()`, `format()`, and `unformat()`.
- Crockford Base32 identifier generation with a Modulo-32 alternating-weight checksum.

[Unreleased]: https://github.com/smart-science/smart-id/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/smart-science/smart-id/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/smart-science/smart-id/releases/tag/v0.1.0
