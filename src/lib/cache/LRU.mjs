/**
 * A class representing a Least Recently Used (LRU) cache.
 */
export class LRU {
  /**
   * Creates an instance of LRUCache.
   *
   * @param {number} capacity - The maximum number of items the cache can hold.
   * @throws {TypeError} If capacity is not a positive integer.
   */
  constructor (capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new TypeError('INVALID_CAPACITY')
    this.capacity = capacity
    this.cache = new Map()
  }

  /**
   * Retrieves the value associated with the given key.
   * Updates the key's position to mark it as recently used.
   *
   * @param {*} key - The key of the item to retrieve.
   * @returns {*} The value associated with the key, or -1 if the key is not found.
   */
  get (key) {
    if (!this.cache.has(key)) {
      return -1
    }
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  /**
   * Inserts or updates the value for the given key.
   * If the cache exceeds its capacity, evicts the least recently used item.
   *
   * @param {*} key - The key of the item to insert or update.
   * @param {*} value - The value to associate with the key.
   */
  put (key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.cache.set(key, value)
    if (this.cache.size > this.capacity) {
      // evict least recently used item (first item in the map)
      const oldest = this.cache.keys().next().value
      this.cache.delete(oldest)
    }
  }

  /**
   * Deletes the key from the cache.
   *
   * @param {*} key - The key of the item to delete.
   * @returns {boolean} True if the key was deleted, false if the key was not found.
   */
  delete (key) {
    return this.cache.delete(key)
  }
}
