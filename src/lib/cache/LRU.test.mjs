import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { LRU } from './LRU.mjs'

describe('# cache', () => {
  describe('## lru', () => {
    it('should throw TypeError if capacity is not a positive integer', () => {
      assert.throws(() => new LRU(0), {
        name: 'TypeError',
        message: 'INVALID_CAPACITY'
      })
      assert.throws(() => new LRU(-1), {
        name: 'TypeError',
        message: 'INVALID_CAPACITY'
      })
      assert.throws(() => new LRU(1.5), {
        name: 'TypeError',
        message: 'INVALID_CAPACITY'
      })
      assert.throws(() => new LRU('2'), {
        name: 'TypeError',
        message: 'INVALID_CAPACITY'
      })
    })

    it('should create an instance with the given capacity', () => {
      const cache = new LRU(2)
      assert.strictEqual(cache.capacity, 2)
      assert.strictEqual(cache.cache.size, 0)
    })

    it('should return -1 for get() when key is not found', () => {
      const cache = new LRU(2)
      assert.strictEqual(cache.get(1), -1)
    })

    it('should put and get items correctly', () => {
      const cache = new LRU(2)
      cache.put(1, 'one')
      cache.put(2, 'two')
      assert.strictEqual(cache.get(1), 'one')
      assert.strictEqual(cache.get(2), 'two')
    })

    it('should evict the least recently used item when capacity is exceeded', () => {
      const cache = new LRU(2)
      cache.put(1, 'one')
      cache.put(2, 'two')
      cache.put(3, 'three') // Should evict key 1
      assert.strictEqual(cache.get(1), -1)
      assert.strictEqual(cache.get(2), 'two')
      assert.strictEqual(cache.get(3), 'three')
    })

    it('should update the usage order when get() is called', () => {
      const cache = new LRU(2)
      cache.put(1, 'one')
      cache.put(2, 'two')
      cache.get(1) // Access key 1
      cache.put(3, 'three') // Should evict key 2
      assert.strictEqual(cache.get(1), 'one')
      assert.strictEqual(cache.get(2), -1)
      assert.strictEqual(cache.get(3), 'three')
    })

    it('should update the usage order when put() is called with existing key', () => {
      const cache = new LRU(2)
      cache.put(1, 'one')
      cache.put(2, 'two')
      cache.put(1, 'ONE') // Update key 1
      cache.put(3, 'three') // Should evict key 2
      assert.strictEqual(cache.get(1), 'ONE')
      assert.strictEqual(cache.get(2), -1)
      assert.strictEqual(cache.get(3), 'three')
    })

    it('should handle various data types as keys and values', () => {
      const cache = new LRU(2)
      const objKey = { id: 1 }
      const objValue = { name: 'object' }
      cache.put(objKey, objValue)
      cache.put('string', 42)
      assert.deepEqual(cache.get(objKey), objValue)
      assert.strictEqual(cache.get('string'), 42)
    })

    it('should maintain correct order after multiple operations', () => {
      const cache = new LRU(3)
      cache.put(1, 'one')
      cache.put(2, 'two')
      cache.put(3, 'three')
      cache.get(2) // Access key 2
      cache.put(4, 'four') // Should evict key 1
      assert.strictEqual(cache.get(1), -1)
      assert.strictEqual(cache.get(2), 'two')
      assert.strictEqual(cache.get(3), 'three')
      assert.strictEqual(cache.get(4), 'four')
    })

    it('should not throw errors when keys are undefined or null', () => {
      const cache = new LRU(2)
      cache.put(undefined, 'undefined')
      cache.put(null, 'null')
      assert.strictEqual(cache.get(undefined), 'undefined')
      assert.strictEqual(cache.get(null), 'null')
    })

    it('should overwrite existing values for the same key', () => {
      const cache = new LRU(2)
      cache.put(1, 'one')
      cache.put(1, 'ONE')
      assert.strictEqual(cache.get(1), 'ONE')
    })
  })
})
