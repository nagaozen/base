import { typeOf } from '../typeOf.mjs'

/**
 * Escape a single reference-token per RFC6901:
 *   "~" → "~0"
 *   "/" → "~1"
 *
 * @param {string} token
 * @returns {string}
 * @throws {TypeError} if token is not a string
 */
export function escape (token) {
  if (typeOf(token) !== 'string') { throw new TypeError(`escape(token): token must be a string, got ${typeOf(token)}`) }

  return token
    .replace(/~/g, '~0')
    .replace(/\//g, '~1')
}

/**
 * Unescape a single reference-token per RFC6901:
 *   "~1" → "/"
 *   "~0" → "~"
 *
 * @param {string} token
 * @returns {string}
 * @throws {TypeError} if token is not a string
 */
export function unescape (token) {
  if (typeOf(token) !== 'string') { throw new TypeError(`unescape(token): token must be a string, got ${typeOf(token)}`) }

  return token
    .replace(/~1/g, '/')
    .replace(/~0/g, '~')
}

/**
 * Parse a JSON Pointer into its array of unescaped tokens.
 *
 * @param {string} pointer  e.g. "/foo/0/bar~1baz"
 * @returns {string[]}      e.g. ["foo","0","bar/baz"]
 * @throws {TypeError} if pointer is not a string
 * @throws {Error}     if non-empty and missing leading "/"
 */
export function parse (pointer) {
  if (typeOf(pointer) !== 'string') { throw new TypeError(`parse(pointer): pointer must be a string, got ${typeOf(pointer)}`) }
  if (pointer === '') return []
  if (pointer[0] !== '/') throw new Error('Invalid JSON Pointer: must start with "/" or be empty')
  return pointer
    .split('/')
    .slice(1)
    .map(unescape)
}

/**
 * Build a JSON Pointer from an array of reference-tokens.
 *
 * @param {unknown[]} tokens  array of strings
 * @returns {string}         JSON Pointer (always starts with "/"), or "" if []
 * @throws {TypeError} if tokens is not an array of strings
 */
export function stringify (tokens) {
  if (!Array.isArray(tokens)) { throw new TypeError('stringify(tokens): tokens must be an array') }
  if (tokens.length === 0) return ''
  // ensure each token is a string
  for (const token of tokens) {
    if (typeof token !== 'string') { throw new TypeError('stringify(tokens): each token must be a string') }
  }
  return '/' + tokens.map(escape).join('/')
}

/**
 * Retrieve the value at the given JSON Pointer, or undefined.
 *
 * @param {*} root     any JSON‑like structure
 * @param {string} pointer
 * @returns {*}        the found value, or undefined
 * @throws {TypeError} if pointer is not a string
 */
export function get (root, pointer) {
  const tokens = parse(pointer)
  let current = root
  for (const token of tokens) {
    if (current == null) return undefined // catches both null and undefined
    current = current[token]
  }
  return current
}

/**
 * Set a value at the given JSON Pointer, creating objects/arrays as needed.
 *
 * Note: does not support "-" (append) notation.
 *
 * @param {object|array} root
 * @param {string} pointer  must not be "" (root replace is disallowed)
 * @param {*} value
 * @throws {TypeError} if pointer is not a string
 * @throws {Error}     if pointer === "" or traversal fails
 */
export function set (root, pointer, value) {
  const tokens = parse(pointer)
  if (tokens.length === 0) throw new Error('Root document cannot be replaced')
  let parent = root
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]
    if (typeof parent[token] === 'undefined') {
      // decide whether next should be array or object
      const next = tokens[i + 1]
      parent[token] = /^\d+$/.test(next) ? [] : {}
    }
    parent = parent[token]
    if (parent == null || typeof parent !== 'object') throw new Error(`Cannot traverse into non-object at "${tokens.slice(0, i + 1).join('/')}"`)
  }
  const leaf = tokens[tokens.length - 1]
  parent[leaf] = value
}
