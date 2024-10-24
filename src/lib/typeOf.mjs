/**
 * Determines the precise type of a given value.
 *
 * Returns a lowercase string representing the specific type of the input value.
 * This function improves upon the built-in `typeof` operator by correctly identifying
 * types like 'array', 'null', 'date', 'regexp', etc.
 *
 * @param {*} x - The value to determine the type of.
 * @returns {string} A string representing the type of the input value.
 *
 * @example
 * typeOf(42);              // 'number'
 * typeOf('Hello');         // 'string'
 * typeOf(null);            // 'null'
 * typeOf(undefined);       // 'undefined'
 * typeOf({});              // 'object'
 * typeOf([]);              // 'array'
 * typeOf(() => {});        // 'function'
 * typeOf(new Date());      // 'date'
 * typeOf(/regex/);         // 'regexp'
 * typeOf(Symbol('id'));    // 'symbol'
 * typeOf(BigInt(123));     // 'bigint'
 */
export function typeOf (x) {
  return Object.prototype.toString.call(x).slice(8, -1).toLowerCase()
}
