/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import type {
    FormattedSID,
    FormattedSidBrand,
    format,
    generate,
    generateFormatted,
    parse,
    Result,
    SID,
    SidBrand,
    unformat,
    verify,
} from '../../src/index';
import type { Equal, Expect, ExpectFalse, Extends } from './type-utils';

// -------------------------------------------------------------------
// 2. Return Type Invariants
// -------------------------------------------------------------------

// 2.1 generate returns canonical SID.
export type Test_Generate_ReturnType = Expect<Equal<ReturnType<typeof generate>, SID>>;

// 2.2 generateFormatted returns FormattedSID.
export type Test_GenerateFormatted_ReturnType = Expect<Equal<ReturnType<typeof generateFormatted>, FormattedSID>>;

// 2.3 verify returns pure boolean.
export type Test_Verify_ReturnType = Expect<Equal<ReturnType<typeof verify>, boolean>>;

// 2.4 parse returns Result<SID>.
export type Test_Parse_ReturnType = Expect<Equal<ReturnType<typeof parse>, Result<SID>>>;

// 2.5 format returns Result<FormattedSID>.
export type Test_Format_ReturnType = Expect<Equal<ReturnType<typeof format>, Result<FormattedSID>>>;

// 2.6 unformat returns canonical SID.
export type Test_Unformat_ReturnType = Expect<Equal<ReturnType<typeof unformat>, SID>>;

// -------------------------------------------------------------------
// 3. Nominal Branding & Subtype Invariants
// -------------------------------------------------------------------

// 3.1 SID is a subtype of string.
export type Test_SID_Extends_String = Expect<Extends<SID, string>>;

// 3.2 FormattedSID is a subtype of string.
export type Test_FormattedSID_Extends_String = Expect<Extends<FormattedSID, string>>;

// 3.3 FormattedSID matches quad-grouped template literal pattern.
export type Test_FormattedSID_Pattern = Expect<Extends<FormattedSID, `${string}-${string}-${string}-${string}`>>;

// 3.4 unvalidated string cannot be assigned to nominal SID.
export type Test_String_Does_Not_Extend_SID = ExpectFalse<Extends<string, SID>>;

// 3.5 unvalidated string cannot be assigned to FormattedSID.
export type Test_String_Does_Not_Extend_FormattedSID = ExpectFalse<Extends<string, FormattedSID>>;

// 3.6 canonical SID cannot be assigned to FormattedSID without explicit formatting.
export type Test_SID_Does_Not_Extend_FormattedSID = ExpectFalse<Extends<SID, FormattedSID>>;

// 3.7 FormattedSID cannot be assigned to canonical SID without parsing or unformatting.
export type Test_FormattedSID_Does_Not_Extend_SID = ExpectFalse<Extends<FormattedSID, SID>>;

// 3.8 unvalidated string cannot be passed directly to unformat parameter.
type UnformatParameter = Parameters<typeof unformat>[0];
export type Test_String_Does_Not_Extend_UnformatParam = ExpectFalse<Extends<string, UnformatParameter>>;

// 3.9 brand symbols are exported unique symbols.
export type Test_SidBrand_Is_Symbol = Expect<Extends<typeof SidBrand, symbol>>;
export type Test_FormattedSidBrand_Is_Symbol = Expect<Extends<typeof FormattedSidBrand, symbol>>;

// -------------------------------------------------------------------
// 4. Result Discriminated Union Shape
// -------------------------------------------------------------------

type SuccessBranch<T> = Extract<Result<T>, { ok: true }>;
type FailureBranch<T> = Extract<Result<T>, { ok: false }>;

// 4.1 success branch exposes readonly data and ok: true.
export type Test_Result_Success_Shape = Expect<Equal<SuccessBranch<SID>, { readonly ok: true; readonly data: SID }>>;

// 4.2 failure branch exposes readonly error and ok: false.
export type Test_Result_Failure_Shape = Expect<
    Equal<FailureBranch<SID>, { readonly ok: false; readonly error: string }>
>;
