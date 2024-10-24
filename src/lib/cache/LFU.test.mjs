import { describe, it } from 'node:test'
import assert from 'node:assert'

import { LFU } from './LFU.mjs'

describe('# cache', () => {
  describe('## lfu', () => {
    it('should throw an error for invalid capacity', () => {
      assert.throws(() => {
        new LFU(0)// eslint-disable-line no-new
      }, { name: 'TypeError', message: 'INVALID_CAPACITY' })
      assert.throws(() => {
        new LFU(-1)// eslint-disable-line no-new
      }, { name: 'TypeError', message: 'INVALID_CAPACITY' })
      assert.throws(() => {
        new LFU(1.5)// eslint-disable-line no-new
      }, { name: 'TypeError', message: 'INVALID_CAPACITY' })
    })

    it('should return -1 for get operations on an empty cache', () => {
      const cache = new LFU(2)
      assert.strictEqual(cache.get(1), -1)
    })

    it('should perform put and get operations correctly', () => {
      const cache = new LFU(2)
      cache.put(1, 'A')
      cache.put(2, 'B')
      assert.strictEqual(cache.get(1), 'A') // Frequency of key 1 becomes 2
      cache.put(3, 'C') // Evicts key 2 (LFU)
      assert.strictEqual(cache.get(2), -1) // Key 2 was evicted
      assert.strictEqual(cache.get(3), 'C')
      assert.strictEqual(cache.get(1), 'A')
      cache.put(4, 'D') // Evicts key 3
      assert.strictEqual(cache.get(3), -1) // Key 3 was evicted
      assert.strictEqual(cache.get(4), 'D')
      assert.strictEqual(cache.get(1), 'A') // Key 1 remains
    })

    it('should update value and frequency when putting an existing key', () => {
      const cache = new LFU(2)
      cache.put(1, 'A')
      cache.put(1, 'AA') // Update value
      assert.strictEqual(cache.get(1), 'AA') // Frequency should increase
      cache.put(2, 'B')
      cache.put(3, 'C') // Evicts key 2
      assert.strictEqual(cache.get(2), -1) // Key 2 was evicted
      assert.strictEqual(cache.get(1), 'AA')
      assert.strictEqual(cache.get(3), 'C')
    })

    it('should handle tie-breaker using LRU when frequencies are equal', () => {
      const cache = new LFU(2)
      cache.put(1, 'A')
      cache.put(2, 'B')
      cache.get(1) // Frequency of key 1 becomes 2
      cache.get(2) // Frequency of key 2 becomes 2
      cache.put(3, 'C') // Both keys have same frequency; evict LRU key (key 1)
      assert.strictEqual(cache.get(1), -1) // Key 1 was evicted
      assert.strictEqual(cache.get(2), 'B')
      assert.strictEqual(cache.get(3), 'C')
    })

    it('should delete keys correctly', () => {
      const cache = new LFU(2)
      cache.put(1, 'A')
      cache.put(2, 'B')
      assert.strictEqual(cache.delete(1), true) // Key 1 deleted
      assert.strictEqual(cache.get(1), -1)
      cache.put(3, 'C') // Cache has capacity
      assert.strictEqual(cache.get(2), 'B')
      assert.strictEqual(cache.get(3), 'C')
    })

    it('should return false when deleting a non-existent key', () => {
      const cache = new LFU(2)
      assert.strictEqual(cache.delete(1), false)
    })

    it('should update minFU correctly after deletions', () => {
      const cache = new LFU(3)
      cache.put(1, 'A') // freq = 1
      cache.put(2, 'B') // freq = 1
      cache.get(1) // freq of key 1 becomes 2
      cache.delete(1) // minFU should remain 1
      cache.put(3, 'C') // freq = 1
      assert.strictEqual(cache.minFreq, 1)
      assert.strictEqual(cache.get(2), 'B')
      assert.strictEqual(cache.get(3), 'C')
    })

    it('should handle frequent gets and puts correctly', () => {
      const cache = new LFU(2)
      cache.put(1, 'A')
      cache.put(2, 'B')
      cache.get(1) // freq of key 1: 2
      cache.get(1) // freq of key 1: 3
      cache.get(2) // freq of key 2: 2
      cache.put(3, 'C') // Evicts key 2 (freq 2, less than key 1's freq 3)

      assert.strictEqual(cache.get(1), 'A')
      assert.strictEqual(cache.get(2), -1)
      assert.strictEqual(cache.get(3), 'C')
    })
  })
})
