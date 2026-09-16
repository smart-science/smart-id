# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- License changed from `UNLICENSED` to `Apache-2.0`.

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
