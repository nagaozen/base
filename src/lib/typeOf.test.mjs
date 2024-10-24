import { describe, it } from 'node:test'
import assert from 'node:assert'

import { typeOf } from './typeOf.mjs'

describe('# typeOf', () => {
  it('should return "number" for numeric values', () => {
    assert.strictEqual(typeOf(0), 'number')
    assert.strictEqual(typeOf(-1), 'number')
    assert.strictEqual(typeOf(3.14), 'number')
    assert.strictEqual(typeOf(NaN), 'number')
    assert.strictEqual(typeOf(Infinity), 'number')
  })

  it('should return "string" for string values', () => {
    assert.strictEqual(typeOf(''), 'string')
    assert.strictEqual(typeOf('Hello'), 'string')
    assert.strictEqual(typeOf('Template'), 'string')
  })

  it('should return "boolean" for boolean values', () => {
    assert.strictEqual(typeOf(true), 'boolean')
    assert.strictEqual(typeOf(false), 'boolean')
  })

  it('should return "undefined" for undefined', () => {
    assert.strictEqual(typeOf(undefined), 'undefined')
  })

  it('should return "null" for null', () => {
    assert.strictEqual(typeOf(null), 'null')
  })

  it('should return "object" for plain objects', () => {
    assert.strictEqual(typeOf({}), 'object')
    assert.strictEqual(typeOf({ a: 1 }), 'object')
    assert.strictEqual(typeOf(Object.create(null)), 'object')
  })

  it('should return "array" for arrays', () => {
    assert.strictEqual(typeOf([]), 'array')
    assert.strictEqual(typeOf([1, 2, 3]), 'array')
  })

  it('should return "function" for functions', () => {
    assert.strictEqual(typeOf(function () {}), 'function')
    assert.strictEqual(typeOf(() => {}), 'function')
    assert.strictEqual(typeOf(async function () {}), 'asyncfunction')
  })

  it('should return "date" for Date objects', () => {
    assert.strictEqual(typeOf(new Date()), 'date')
  })

  it('should return "regexp" for RegExp objects', () => {
    assert.strictEqual(typeOf(/regex/), 'regexp')
    assert.strictEqual(typeOf(new RegExp('regex')), 'regexp')// eslint-disable-line prefer-regex-literals
  })

  it('should return "symbol" for Symbol values', () => {
    assert.strictEqual(typeOf(Symbol()), 'symbol')// eslint-disable-line symbol-description
    assert.strictEqual(typeOf(Symbol('id')), 'symbol')
  })

  it('should return "bigint" for BigInt values', () => {
    assert.strictEqual(typeOf(BigInt(123)), 'bigint')
  })

  it('should return the correct type for Error objects', () => {
    assert.strictEqual(typeOf(new Error()), 'error')
    assert.strictEqual(typeOf(new TypeError()), 'error')
  })

  it('should return "map" for Map objects', () => {
    assert.strictEqual(typeOf(new Map()), 'map')
  })

  it('should return "set" for Set objects', () => {
    assert.strictEqual(typeOf(new Set()), 'set')
  })

  it('should return "weakmap" for WeakMap objects', () => {
    assert.strictEqual(typeOf(new WeakMap()), 'weakmap')
  })

  it('should return "weakset" for WeakSet objects', () => {
    assert.strictEqual(typeOf(new WeakSet()), 'weakset')
  })

  it('should return "arraybuffer" for ArrayBuffer objects', () => {
    assert.strictEqual(typeOf(new ArrayBuffer(10)), 'arraybuffer')
  })

  it('should return "dataview" for DataView objects', () => {
    assert.strictEqual(typeOf(new DataView(new ArrayBuffer(10))), 'dataview')
  })

  it('should return "promise" for Promise objects', () => {
    assert.strictEqual(typeOf(Promise.resolve()), 'promise')
  })

  it('should handle custom objects with Symbol.toStringTag', () => {
    class CustomClass {
      get [Symbol.toStringTag] () {
        return 'Custom'
      }
    }
    assert.strictEqual(typeOf(new CustomClass()), 'custom')
  })
})
