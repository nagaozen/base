import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  itFromPath,
  _get,
  _set,
  _delete
} from './index.mjs'

describe('# object', () => {
  describe('## itFromPath', () => {
    it('should handle simple dot notation paths', () => {
      assert.deepStrictEqual(itFromPath('a.b.c'), [
        { key: 'a', isArrayIndex: false },
        { key: 'b', isArrayIndex: false },
        { key: 'c', isArrayIndex: false }
      ])
    })

    it('should handle array indices in brackets', () => {
      assert.deepStrictEqual(itFromPath('a[0].b'), [
        { key: 'a', isArrayIndex: false },
        { key: '0', isArrayIndex: true },
        { key: 'b', isArrayIndex: false }
      ])
      assert.deepStrictEqual(itFromPath('a[1][2]'), [
        { key: 'a', isArrayIndex: false },
        { key: '1', isArrayIndex: true },
        { key: '2', isArrayIndex: true }
      ])
    })

    it('should handle quoted property names inside brackets', () => {
      assert.deepStrictEqual(itFromPath('a["b"].c'), [
        { key: 'a', isArrayIndex: false },
        { key: 'b', isArrayIndex: false },
        { key: 'c', isArrayIndex: false }
      ])
      assert.deepStrictEqual(itFromPath("a['b'].c"), [
        { key: 'a', isArrayIndex: false },
        { key: 'b', isArrayIndex: false },
        { key: 'c', isArrayIndex: false }
      ])
    })

    it('should handle quoted property names with dots inside', () => {
      assert.deepStrictEqual(itFromPath('a["b.c"].d'), [
        { key: 'a', isArrayIndex: false },
        { key: 'b.c', isArrayIndex: false },
        { key: 'd', isArrayIndex: false }
      ])
      assert.deepStrictEqual(itFromPath("a['b.c'].d"), [
        { key: 'a', isArrayIndex: false },
        { key: 'b.c', isArrayIndex: false },
        { key: 'd', isArrayIndex: false }
      ])
    })

    it('should handle paths with special characters', () => {
      assert.deepStrictEqual(itFromPath('a.$b.c'), [
        { key: 'a', isArrayIndex: false },
        { key: '$b', isArrayIndex: false },
        { key: 'c', isArrayIndex: false }
      ])
      assert.deepStrictEqual(itFromPath('a._b.c'), [
        { key: 'a', isArrayIndex: false },
        { key: '_b', isArrayIndex: false },
        { key: 'c', isArrayIndex: false }
      ])
    })

    it('should handle paths with numbers in property names', () => {
      assert.deepStrictEqual(itFromPath('a.b1.c'), [
        { key: 'a', isArrayIndex: false },
        { key: 'b1', isArrayIndex: false },
        { key: 'c', isArrayIndex: false }
      ])
    })

    it('should handle numeric property names', () => {
      assert.deepStrictEqual(itFromPath('a.0.b'), [
        { key: 'a', isArrayIndex: false },
        { key: '0', isArrayIndex: false }, // '0' in dot notation is not treated as an array index
        { key: 'b', isArrayIndex: false }
      ])
    })

    it('should handle empty string path', () => {
      assert.deepStrictEqual(itFromPath(''), [
        { key: '', isArrayIndex: false }
      ])
    })
  })

  describe('## _get', () => {
    it('should retrieve the value at a simple path', () => {
      const obj = { a: { b: { c: 42 } } }
      const value = _get(obj, 'a.b.c')
      assert.strictEqual(value, 42)
    })

    it('should return the default value for non-existent paths', () => {
      const obj = { a: { b: { c: 42 } } }
      const value = _get(obj, 'a.b.x', 'default')
      assert.strictEqual(value, 'default')
    })

    it('should handle array indices in paths', () => {
      const obj = { a: [{ b: 'value' }] }
      const value = _get(obj, 'a[0].b')
      assert.strictEqual(value, 'value')
    })

    it('should handle quoted property names in paths', () => {
      const obj = { a: { 'b.c': { d: 100 } } }
      const value = _get(obj, 'a["b.c"].d')
      assert.strictEqual(value, 100)
    })

    it('should handle numeric property names', () => {
      const obj = { a: { 123: { b: 50 } } }
      const value = _get(obj, 'a.123.b')
      assert.strictEqual(value, 50)
    })

    it('should handle intermediate null values', () => {
      const obj = { a: null }
      const value = _get(obj, 'a.b')
      assert.strictEqual(value, undefined)
    })

    it('should retrieve values from arrays', () => {
      const obj = { a: [1, 2, 3] }
      const value = _get(obj, 'a[1]')
      assert.strictEqual(value, 2)
    })

    it('should handle deeply nested structures', () => {
      const obj = { a: { b: [{ c: { d: 'deep' } }] } }
      const value = _get(obj, 'a.b[0].c.d')
      assert.strictEqual(value, 'deep')
    })

    it('should return default value when accessing property on undefined', () => {
      const obj = { a: undefined }
      const value = _get(obj, 'a.b', 'default')
      assert.strictEqual(value, 'default')
    })

    it('should handle empty path', () => {
      const obj = { '': 'empty' }
      const value = _get(obj, '')
      assert.strictEqual(value, 'empty')
    })

    it('should handle special characters in property names', () => {
      const obj = { 'a-b': { 'c.d': { e_f: 'value' } } }
      const value = _get(obj, 'a-b["c.d"].e_f')
      assert.strictEqual(value, 'value')
    })
  })

  describe('## _set', () => {
    it('should set a value at a simple path', () => {
      const obj = {}
      _set(obj, 'a.b.c', 42)
      assert.deepStrictEqual(obj, { a: { b: { c: 42 } } })
    })

    it('should create arrays for numeric indices', () => {
      const obj = {}
      _set(obj, 'arr[0].value', 'test')
      assert.deepStrictEqual(obj, { arr: [{ value: 'test' }] })
    })

    it('should handle quoted property names', () => {
      const obj = {}
      _set(obj, 'a["b"].c', 123)
      assert.deepStrictEqual(obj, { a: { b: { c: 123 } } })
    })

    it('should overwrite existing values', () => {
      const obj = { a: { b: { c: 1 } } }
      _set(obj, 'a.b.c', 2)
      assert.deepStrictEqual(obj, { a: { b: { c: 2 } } })
    })

    it('should not overwrite existing objects when not necessary', () => {
      const obj = { a: { b: {} } }
      _set(obj, 'a.b.c', 3)
      assert.deepStrictEqual(obj, { a: { b: { c: 3 } } })
    })

    it('should handle non-existent intermediate keys', () => {
      const obj = {}
      _set(obj, 'x.y.z', 'value')
      assert.deepStrictEqual(obj, { x: { y: { z: 'value' } } })
    })

    it('should handle null or primitive intermediate values by overwriting them', () => {
      const obj = { a: null }
      _set(obj, 'a.b', 4)
      assert.deepStrictEqual(obj, { a: { b: 4 } })
    })

    it('should handle numeric property names', () => {
      const obj = {}
      _set(obj, 'a.0.b', 5)
      assert.deepStrictEqual(obj, { a: { 0: { b: 5 } } })
    })

    it('should treat numeric property names as object keys if not an array index', () => {
      const obj = {}
      _set(obj, 'data.123.value', 'test')
      assert.deepStrictEqual(obj, { data: { 123: { value: 'test' } } })
    })

    it('should return the modified object', () => {
      const obj = {}
      const result = _set(obj, 'a.b', 6)
      assert.strictEqual(result, obj)
    })

    it('should handle root not being an object', () => {
      const obj = null
      assert.throws(() => _set(obj, 'a.b', 8), {
        name: 'TypeError',
        message: 'obj needs to be an object'
      })
    })

    it('should handle empty path', () => {
      const obj = {}
      _set(obj, '', 9)
      assert.deepStrictEqual(obj, { '': 9 })
    })
  })

  describe('## _delete', () => {
    it('should delete a property using dot notation path', () => {
      const obj = { a: { b: { c: 42 } } }
      const result = _delete(obj, 'a.b.c')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: { b: {} } })
    })

    it('should delete a property using bracket notation path', () => {
      const obj = { a: [{ b: 1 }, { c: 2 }] }
      const result = _delete(obj, 'a[1].c')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: [{ b: 1 }, {}] })
    })

    it('should return true if the property does not exist', () => {
      const obj = { a: { b: {} } }
      const result = _delete(obj, 'a.b.c')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: { b: {} } })
    })

    it('should handle deletion at the root level', () => {
      const obj = { a: 1 }
      const result = _delete(obj, 'a')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, {})
    })

    it('should throw TypeError when obj is not an object', () => {
      assert.throws(() => {
        _delete(null, 'a.b')
      }, {
        name: 'TypeError',
        message: 'obj needs to be an object'
      })
      assert.throws(() => {
        _delete(undefined, 'a.b')
      }, {
        name: 'TypeError',
        message: 'obj needs to be an object'
      })
    })

    it('should handle numeric keys in paths', () => {
      const obj = { a: { b: [1, 2, 3] } }
      const result = _delete(obj, 'a.b[1]')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: { b: [1, 3] } })
    })

    it('should not delete a property if intermediate path does not exist', () => {
      const obj = { a: {} }
      const result = _delete(obj, 'a.b.c')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: {} })
    })

    it('should handle paths with mixed dot and bracket notation', () => {
      const obj = { a: [{ b: { c: 42 } }] }
      const result = _delete(obj, 'a[0].b.c')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: [{ b: {} }] })
    })

    it('should not throw an error when deleting a non-existent property from an array', () => {
      const obj = { a: [] }
      const result = _delete(obj, 'a[0].b')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: [] })
    })

    it('should delete an element from an array using array index', () => {
      const obj = { a: [10, 20, 30] }
      const result = _delete(obj, 'a[1]')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: [10, 30] })
    })

    it('should delete nested array elements', () => {
      const obj = { a: { b: [{ c: 1 }, { c: 2 }] } }
      const result = _delete(obj, 'a.b[1].c')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: { b: [{ c: 1 }, {}] } })
    })

    it('should handle invalid paths gracefully', () => {
      const obj = { a: { b: 1 } }
      const result = _delete(obj, 'a.b.c.d')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: { b: 1 } })
    })

    it('should delete properties with numeric keys', () => {
      const obj = { a: { 1: { b: 2 } } }
      const result = _delete(obj, 'a.1.b')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: { 1: {} } })
    })

    it('should delete properties when path is a single key', () => {
      const obj = { a: 1, b: 2 }
      const result = _delete(obj, 'b')
      assert.strictEqual(result, true)
      assert.deepEqual(obj, { a: 1 })
    })
  })
})
