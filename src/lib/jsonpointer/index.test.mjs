import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { escape, unescape, parse, stringify, get, set } from './index.mjs'

describe('escape / unescape', () => {
  it('escape "~" and "/" correctly', () => {
    assert.equal(escape('~/foo/~'), '~0~1foo~1~0')
  })
  it('unescape "~1" and "~0" correctly', () => {
    assert.equal(unescape('~1~0bar~1'), '/~bar/')
  })
  it('throws on non-string input', () => {
    assert.throws(() => escape(5), TypeError)
    assert.throws(() => unescape(null), TypeError)
  })
})

describe('parse()', () => {
  it('empty pointer → []', () => {
    assert.deepEqual(parse(''), [])
  })
  it('"/" → [""] (empty-token)', () => {
    assert.deepEqual(parse('/'), [''])
  })
  it('splits and unescapes tokens', () => {
    assert.deepEqual(parse('/a~1b/~0c'), ['a/b', '~c'])
  })
  it('throws on missing leading slash', () => {
    assert.throws(() => parse('foo'), /must start with "\/"/)
  })
  it('throws on non-string', () => {
    assert.throws(() => parse(123), TypeError)
  })
})

describe('stringify()', () => {
  it('[] → ""', () => {
    assert.equal(stringify([]), '')
  })
  it('tokens → pointer', () => {
    assert.equal(stringify(['a/b', '~c']), '/a~1b/~0c')
  })
  it('throws if not array or non-string elements', () => {
    assert.throws(() => stringify('foo'), TypeError)
    assert.throws(() => stringify([1, 2]), TypeError)
  })
})

describe('get()', () => {
  const doc = { arr: ['x', { foo: 3 }], nil: null }
  it('"" → root', () => {
    assert.strictEqual(get(doc, ''), doc)
  })
  it('nested paths', () => {
    assert.strictEqual(get(doc, '/arr/1/foo'), 3)
  })
  it('missing path → undefined', () => {
    assert.strictEqual(get(doc, '/nope'), undefined)
    assert.strictEqual(get(doc, '/arr/5'), undefined)
  })
  it('null leaf preserved', () => {
    assert.strictEqual(get(doc, '/nil'), null)
  })
  it('throws on non-string pointer', () => {
    assert.throws(() => get(doc, {}), TypeError)
  })
})

describe('set()', () => {
  it('throws on non-string pointer', () => {
    assert.throws(() => set({}, null, 1), TypeError)
  })
  it('throws on root replace', () => {
    assert.throws(() => set({}, '', 5), Error)
  })
  it('creates nested objects', () => {
    const o = {}
    set(o, '/a/b/c', 7)
    assert.deepEqual(o, { a: { b: { c: 7 } } })
  })
  it('creates arrays for numeric tokens and sets values', () => {
    const o = {}
    set(o, '/x/0/y', 'hi')
    assert.deepEqual(o, { x: [{ y: 'hi' }] })
  })
  it('overwrites existing values', () => {
    const o = { x: 1 }
    set(o, '/x', 2)
    assert.equal(o.x, 2)
  })
  it('throws when traversing into non-object', () => {
    const o = { a: 5 }
    assert.throws(() => set(o, '/a/b', 3), Error)
  })
})
