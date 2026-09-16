/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Imports
// -------------------------------------------------------------------

import type {
    FormattedSID,
    format,
    generate,
    generateFormatted,
    isFormattedSID,
    isSID,
    parse,
    Result,
    SID,
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

// 2.7 isSID is a type guard narrowing unknown to input is SID.
export type Test_IsSID_TypeGuard = Expect<Extends<typeof isSID, (input: unknown) => input is SID>>;

// 2.8 isFormattedSID is a type guard narrowing unknown to input is FormattedSID.
export type Test_IsFormattedSID_TypeGuard = Expect<
    Extends<typeof isFormattedSID, (input: unknown) => input is FormattedSID>
>;

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

// -------------------------------------------------------------------
// 5. Compile-Time Narrowing & Usability Invariants
// -------------------------------------------------------------------

// 5.1 FormattedSID can be used as a plain string.
declare const formattedExample: FormattedSID;
export const _plainStringTest: string = formattedExample;
export const _templateLiteralTest = `ID: ${formattedExample}`;
export const _startsWithTest: boolean = formattedExample.startsWith('0123');

// 5.2 Accessing .data on Result<SID> without checking .ok is a compile-time type error.
declare const result: Result<SID>;
// @ts-expect-error Property 'data' does not exist on type '{ readonly ok: false; readonly error: string; }'.
export const _invalidDataAccess = result.data;

// 5.3 Accessing .error on Result<SID> without checking !.ok is a compile-time type error.
// @ts-expect-error Property 'error' does not exist on type '{ readonly ok: true; readonly data: SID; }'.
export const _invalidErrorAccess = result.error;

// 5.4 Narrowing via ok discriminator separates data and error branches.
if (result.ok) {
    const _narrowedData: SID = result.data;
    // @ts-expect-error Property 'error' does not exist on success branch.
    const _errorOnSuccess = result.error;
} else {
    const _narrowedError: string = result.error;
    // @ts-expect-error Property 'data' does not exist on failure branch.
    const _dataOnFailure = result.data;
}

// 5.5 isSID narrows unknown to SID.
declare const unknownValue: unknown;
declare const checkIsSID: typeof isSID;
if (checkIsSID(unknownValue)) {
    const _narrowedSID: SID = unknownValue;
    const _isString: string = unknownValue;
}

// 5.6 isFormattedSID narrows unknown to FormattedSID.
declare const checkIsFormattedSID: typeof isFormattedSID;
if (checkIsFormattedSID(unknownValue)) {
    const _narrowedFormatted: FormattedSID = unknownValue;
    const _isString: string = unknownValue;
}
