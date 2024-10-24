import { typeOf } from '../typeOf.mjs'

/**
 * Converts a string path into an array of keys.
 *
 * This function parses a string representing a path to a property in an object
 * and converts it into an array of keys for property access. The path can include
 * dot notation, bracket notation with numbers, and bracket notation with quoted strings.
 *
 * @param {string} path - The path string to convert.
 * @returns {Array<string|number>} - The array of keys representing the path.
 *
 * @example
 * itFromPath('a.b.c'); // returns [{ key: 'a', isArrayIndex: false }, { key: 'b', isArrayIndex: false }, { key: 'c', isArrayIndex: false }]
 * itFromPath('a[0].b'); // returns [{ key: 'a', isArrayIndex: false }, { key: '0', isArrayIndex: true }, { key: 'b', isArrayIndex: false }]
 * itFromPath('a["b"].c'); // returns [{ key: 'a', isArrayIndex: false }, { key: 'b', isArrayIndex: false }, { key: 'c', isArrayIndex: false }]
 * itFromPath("a['b'].c"); // returns [{ key: 'a', isArrayIndex: false }, { key: 'b', isArrayIndex: false }, { key: 'c', isArrayIndex: false }]
 */
export function itFromPath (path) {
  if (path === '') return [{ key: '', isArrayIndex: false }]
  const it = []
  const re = /([^.[\]]+)|\[(\d+)\]|(?:\["([^"]+)"\])|(?:\['([^']+)'\])/g
  let match
  while ((match = re.exec(path)) !== null) {
    if (match[1] !== undefined) {
      // property name in dot notation
      it.push({ key: match[1], isArrayIndex: false })
    } else if (match[2] !== undefined) {
      // number inside brackets
      it.push({ key: match[2], isArrayIndex: true })
    } else if (match[3] !== undefined) {
      // double-quoted property inside brackets
      it.push({ key: match[3], isArrayIndex: false })
    } else {
      // single-quoted property inside brackets
      it.push({ key: match[4], isArrayIndex: false })
    }
  }
  return it
}

/**
 * Retrieves the value at the specified path of the object. If the value doesn't exist,
 * it returns undefined or an optional default value.
 *
 * @param {Object} obj - The object to query.
 * @param {string | Array<string | number>} path - The path of the property to get.
 * @param {*} [defaultValue] - The value returned if the resolved value is undefined.
 * @returns {*} The value at the specified path.
 *
 * @example
 * const obj = { a: { b: { c: 42 } } }
 * const value = _get(obj, 'a.b.c')
 * console.log(value) // 42
 */
export function _get (obj, path, defaultValue) {
  if (typeOf(obj) !== 'object') throw new TypeError('obj needs to be an object')
  let o = obj
  const it = itFromPath(path)
  for (let i = 0, len = it.length; i < len; i++) {
    const { key } = it[i]
    if (o == null) return defaultValue
    if (i === len - 1) return key in o ? o[key] : defaultValue
    if (!(key in o)) return defaultValue
    o = o[key]
  }
}

/**
 * Sets the value at the specified path of the object. If a portion of the path doesn't exist,
 * it's created. Arrays are created for numeric indices, objects for keys.
 *
 * @param {Object} obj - The object to modify.
 * @param {string | Array<string | number>} path - The path of the property to set.
 * @param {*} value - The value to set.
 * @returns {Object} The modified object.
 *
 * @example
 * const obj = {}
 * _set(obj, 'a.b.c', 42)
 * console.log(obj) // { a: { b: { c: 42 } } }
 *
 * _set(obj, 'x[0].y', 'value')
 * console.log(obj) // { a: { b: { c: 42 } }, x: [ { y: 'value' } ] }
 */
export function _set (obj, path, value) {
  if (typeOf(obj) !== 'object') throw new TypeError('obj needs to be an object')
  let o = obj
  const it = itFromPath(path)
  for (let i = 0, len = it.length; i < len; i++) {
    const { key } = it[i]
    if (i === len - 1) {
      // last key, set the value
      o[key] = value
    } else {
      // if the key doesn't exist or is not an object, create it
      if (!(key in o) || typeof o[key] !== 'object' || o[key] === null) {
        const next = it[i + 1]
        if (next) o[key] = next.isArrayIndex ? [] : {}
      }
      // walk
      o = o[key]
    }
  }
  return obj
}

/**
 * Deletes the property at the specified path of the object. If the property does not exist,
 * the function does nothing. Supports both dot and bracket notation in the path.
 *
 * @param {Object} obj - The object from which to delete the property.
 * @param {string} path - The path of the property to delete.
 * @returns {boolean} Returns `true` if the property was successfully deleted or if the property did not exist.
 * @throws {TypeError} Throws if `obj` is not an object or if `path` is not a string.
 *
 * @example
 * const obj = { a: { b: { c: 42 } } }
 * _delete(obj, 'a.b.c')
 * console.log(obj) // { a: { b: {} } }
 *
 * _delete(obj, 'x[0].y')
 * console.log(obj) // { a: { b: {} } }
 */
export function _delete (obj, path) {
  if (typeOf(obj) !== 'object') throw new TypeError('obj needs to be an object')
  if (typeOf(path) !== 'string') throw new TypeError('path needs to be a string')
  const it = itFromPath(path)
  let o = obj
  for (let i = 0, len = it.length; i < len; i++) {
    const { key, isArrayIndex } = it[i]
    if (i === len - 1) {
      // last key, delete value
      if (isArrayIndex) {
        o.splice(parseInt(key, 10), 1)
      } else {
        delete o[key]
      }
      return true
    }
    if (!['object', 'array'].includes(typeOf(o))) return true
    if (!(key in o)) return true
    o = o[key]
  }
  return true
}
