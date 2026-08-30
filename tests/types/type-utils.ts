/*
 * Copyright 2026 Martin Winkler <martin.winkler.dev@gmail.com>
 * SPDX-License-Identifier: UNLICENSED
 */

// -------------------------------------------------------------------
// 1. Compile-Time Type Assertion Primitives
// -------------------------------------------------------------------

/**
 * Enforces that T is strictly `true`.
 * If T evaluates to `false`, `boolean`, or `never`, tsc emits a type error:
 * "Type 'false' does not satisfy the constraint 'true'".
 */
export type Expect<T extends true> = T;

/**
 * Enforces that T is strictly `false`.
 */
export type ExpectFalse<T extends false> = T;

/**
 * Evaluates exact structural and modifier equality between X and Y.
 * Uses function parameter covariance/contravariance rules.
 * Correctly distinguishes `any`, `never`, `readonly`, and optionality differences.
 */
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/**
 * Checks if T is strictly `never`.
 * Wrapped in tuples [T] to prevent distributive conditional evaluation on naked type parameters.
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Checks assignability (whether A can be assigned to B).
 */
export type Extends<A, B> = [A] extends [B] ? true : false;
