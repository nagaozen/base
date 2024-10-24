/**
 * A class representing a Least Frequently Used (LFU) cache.
 */
export class LFU {
  /**
   * Creates an instance of LFU Cache.
   *
   * @param {number} capacity - The maximum number of items the cache can hold.
   * @throws {TypeError} If capacity is not a positive integer.
   */
  constructor (capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new TypeError('INVALID_CAPACITY')
    this.capacity = capacity
    this.cache = new Map()
    this.keysFromFreq = new Map()
    this.minFreq = 0
  }

  /**
   * Retrieves the value associated with the given key.
   * Updates the key's frequency to mark it as more frequently used.
   *
   * @param {*} key - The key of the item to retrieve.
   * @returns {*} The value associated with the key, or -1 if the key is not found.
   */
  get (key) {
    if (!this.cache.has(key)) {
      return -1
    }
    const { value, freq } = this.cache.get(key)
    // update frequency mappings
    this.cache.set(key, { value, freq: freq + 1 })
    this.keysFromFreq.get(freq).delete(key)
    // clean up old frequency list
    if (this.keysFromFreq.get(freq).size === 0) {
      this.keysFromFreq.delete(freq)
      if (this.minFreq === freq) {
        this.minFreq++
      }
    }
    // add key to the new frequency list
    if (!this.keysFromFreq.has(freq + 1)) {
      this.keysFromFreq.set(freq + 1, new Set())
    }
    this.keysFromFreq.get(freq + 1).add(key)
    return value
  }

  /**
   * Inserts or updates the value for the given key.
   * If the cache exceeds its capacity, evicts the least frequently used item.
   * If multiple items have the same frequency, evicts the least recently used among them.
   *
   * @param {*} key - The key of the item to insert or update.
   * @param {*} value - The value to associate with the key.
   */
  put (key, value) {
    if (this.capacity <= 0) {
      return
    }
    if (this.cache.has(key)) {
      this.cache.set(key, { value, freq: this.cache.get(key).freq })
      this.get(key)
    } else {
      if (this.cache.size >= this.capacity) {
        // evict the least frequently used key
        const lfuKeys = this.keysFromFreq.get(this.minFreq)
        const keyToEvict = lfuKeys.keys().next().value
        lfuKeys.delete(keyToEvict)
        if (lfuKeys.size === 0) {
          this.keysFromFreq.delete(this.minFreq)
        }
        this.cache.delete(keyToEvict)
      }
      this.cache.set(key, { value, freq: 1 })
      this.minFreq = 1
      if (!this.keysFromFreq.has(1)) {
        this.keysFromFreq.set(1, new Set())
      }
      this.keysFromFreq.get(1).add(key)
    }
  }

  /**
   * Deletes the key from the cache.
   *
   * @param {*} key - The key of the item to delete.
   * @returns {boolean} True if the key was deleted, false if the key was not found.
   */
  delete (key) {
    if (!this.cache.has(key)) {
      return false
    }
    const { freq } = this.cache.get(key)
    this.cache.delete(key)
    const keysWithFreq = this.keysFromFreq.get(freq)
    keysWithFreq.delete(key)
    if (keysWithFreq.size === 0) {
      this.keysFromFreq.delete(freq)
      // Update minFreq if necessary
      if (this.minFreq === freq) {
        // Find the next minFreq
        if (this.keysFromFreq.size === 0) {
          this.minFreq = 0
        } else {
          this.minFreq = Math.min(...this.keysFromFreq.keys())
        }
      }
    }
    return true
  }
}
