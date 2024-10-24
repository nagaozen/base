/**
 * Converts a given string to its ASCII representation.
 *
 * This function normalizes the string to NFKD form, removes diacritical marks, and filters out non-ASCII characters.
 * It ensures that the resulting string only contains characters with char codes less than 255.
 *
 * @param {string} str - The string to be converted to ASCII.
 * @returns {string} The ASCII representation of the string.
 *
 * @see [String.prototype.normalize](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
 * @see [Unicode character class escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape)
 */
export function asciiFrom (str) {
  if (typeof str !== 'string') return ''
  return str
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^ 0-9a-zA-Z]/gi, '')
    .trim()
}

/**
 * Converts a given string to camel case.
 *
 * Camel case is a string format where each word after the first is capitalized and all words are joined together without spaces.
 * For example, "Hello World" becomes "helloWorld".
 * More information about camel case can be found on MDN: https://developer.mozilla.org/en-US/docs/Glossary/Camel_case
 *
 * @param {string} str - The string to be converted to camel case.
 * @returns {string} The camel-cased string.
 */
export function camelCaseFrom (str) {
  return asciiFrom(str)
    .toLowerCase()
    .split(/\s+/g)
    .map((t, i) => i <= 0 ? t : `${t.charAt(0).toUpperCase()}${t.slice(1)}`)
    .join('')
}

/**
 * Converts a given string to kebab case.
 *
 * Kebab case is a string format where each word is lowercase and separated by a hyphen.
 * For example, "Hello World" becomes "hello-world".
 * More information about kebab case can be found on MDN: https://developer.mozilla.org/en-US/docs/Glossary/Kebab_case
 *
 * @param {string} str - The string to be converted to kebab case.
 * @returns {string} The kebab-cased string.
 */
export function kebabCaseFrom (str) {
  return asciiFrom(str)
    .toLowerCase()
    .split(/\s+/g)
    .join('-')
}

/**
 * Converts a given string to Pascal case.
 *
 * Pascal case is a string format where each word is capitalized and all words are joined together without spaces.
 * For example, "Hello World" becomes "HelloWorld".
 *
 * @param {string} str - The string to be converted to Pascal case.
 * @returns {string} The Pascal-cased string.
 */
export function pascalCaseFrom (str) {
  return asciiFrom(str)
    .toLowerCase()
    .split(/\s+/g)
    .map(t => `${t.charAt(0).toUpperCase()}${t.slice(1)}`)
    .join('')
}

/**
 * Converts a given string to snake case.
 *
 * Snake case is a string format where each word is lowercase and separated by an underscore.
 * For example, "Hello World" becomes "hello_world".
 * More information about snake case can be found on MDN: https://developer.mozilla.org/en-US/docs/Glossary/Snake_case
 *
 * @param {string} str - The string to be converted to snake case.
 * @returns {string} The snake-cased string.
 */
export function snakeCaseFrom (str) {
  return asciiFrom(str)
    .toLowerCase()
    .split(/\s+/g)
    .join('_')
}
