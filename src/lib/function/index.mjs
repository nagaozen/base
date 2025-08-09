/**
 * Creates a debounced version of the provided function that delays its execution
 * until after `delay` milliseconds have elapsed since the last time it was invoked.
 * Useful for reducing the rate at which a function is called.
 *
 * @param {Function} fun - The function to debounce.
 * @param {number} delay - The number of milliseconds to delay execution.
 * @returns {Function} A debounced version of the provided function.
 *
 * @example
 * // Debounce a resize event handler
 * window.addEventListener('resize', debounce(() => {
 *   console.log('Resize event handler called')
 * }, 300))
 *
 * // Debounce a search input handler
 * const debouncedSearch = debounce((query) => {
 *   performSearch(query)
 * }, 500)
 *
 * inputElement.addEventListener('input', (e) => {
 *   debouncedSearch(e.target.value)
 * })
 */
export function debounce (fun, delay) {
  let timeoutId
  return function (...args) {
    const that = this
    clearTimeout(timeoutId)
    const isAsync = fun.constructor.name === 'AsyncFunction'
    if (isAsync) {
      const p = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => fun.apply(that, args).then(resolve).catch(reject), delay)
      })
      return p
    } else {
      timeoutId = setTimeout(() => fun.apply(that, args), delay)
    }
  }
}

/**
 * Memoizes a function using an arguments trie:
 * - Primitive keys are stored in a `Map`
 * - Object/function keys are stored in a `WeakMap` (to avoid retaining them)
 *
 * Supports optional time-based invalidation via `ttl` (milliseconds).
 * A `ttl` of `0` (default) means entries never expire.
 *
 * Caching is based **only** on the arguments list (not on `this`). If your function
 * depends on `this`, bind it or include instance data in the arguments.
 *
 * Async functions are supported: the returned **Promise** is cached as-is.
 *
 * Extra methods:
 * - `memoized.clear(): void` — clears the entire cache.
 * - `memoized.sweepExpired(budget = Infinity): number` — proactively removes up to `budget`
 *   expired entries (only traverses primitive-keyed branches; `WeakMap` entries are
 *   cleaned lazily on access since they aren’t iterable).
 *
 * @template {(...args: any[]) => any} F
 * @param {F} fn - Function to memoize.
 * @param {{ ttl?: number }} [options] - TTL in ms for time-based invalidation (>= 0 recommended).
 * @returns {F & { clear(): void, sweepExpired(budget?: number): number }}
 *
 * @example
 * const add = (a, b) => a + b
 * const mAdd = memoize(add) // no TTL, never expires
 * mAdd(1, 2) // computes, caches
 * mAdd(1, 2) // returns cached: 3
 *
 * @example
 * const slow = (x) => { const t = Date.now() + 50; while (Date.now() < t){}; return x*x }
 * const mSlow = memoize(slow, { ttl: 100 }) // expires after 100ms
 *
 * @example
 * // Async: caches the Promise
 * const fetcher = memoize(async (id) => fetch(`/api/${id}`).then(r => r.json()), { ttl: 5000 })
 *
 * @example
 * // Be careful with `this` — not part of the cache key:
 * const objA = { k: 2, f: memoize(function (x) { return this.k * x; }) }
 * const objB = { k: 10, f: objA.f }
 * objA.f(3) // 6 (cached under args [3])
 * objB.f(3) // also 6 (reuses cache), not 30
 */
export function memoize (fn, { ttl = 0 } = {}) {
  const now = () => ttl ? Date.now() : 0
  const isFresh = t => !ttl || (Date.now() - t) <= ttl
  const newTrieNode = () => ({ p: new Map(), o: new WeakMap(), result: undefined })

  const trie = newTrieNode()
  function leafFor (args) {
    let node = trie
    for (const arg of args) {
      const isObj = arg !== null && ['object', 'function'].includes(typeof arg)
      const bucket = isObj ? node.o : node.p
      let next = bucket.get(arg)
      if (!next) {
        next = newTrieNode()
        bucket.set(arg, next)
      }
      node = next
    }
    return node
  }

  function memoized (...args) {
    const leaf = leafFor(args)
    const entry = leaf.result
    if (entry && isFresh(entry.t)) return entry.value
    if (entry && !isFresh(entry.t)) leaf.result = undefined
    const value = fn.apply(this, args)
    leaf.result = { value, t: now() }
    return value
  }
  memoized.clear = () => {
    trie.p.clear()
    trie.o = new WeakMap()
    trie.result = undefined
  }
  memoized.sweepExpired = (budget = Infinity) => {
    if (!ttl) return 0
    let removed = 0
    const stack = [[null, null, trie, 0]]
    while (stack.length && removed < budget) {
      const [parent, key, node, stage] = stack.pop()
      if (stage === 0) {
        stack.push([parent, key, node, 1])
        for (const [k, child] of node.p) {
          stack.push([node, k, child, 0])
        }
        continue
      }
      const entry = node.result
      if (entry && !isFresh(entry.t)) {
        node.result = undefined
        removed++
      }

      if (parent && !node.result && node.p.size === 0) parent.p.delete(key)
    }
    return removed
  }

  return memoized
}

/**
 * Creates a throttled version of the provided function that only invokes the function
 * at most once every `wait` milliseconds. Subsequent calls within the `wait` period
 * are ignored.
 *
 * @param {Function} fun - The function to throttle.
 * @param {number} wait - The number of milliseconds to wait before allowing the next call.
 * @returns {Function} A throttled version of the provided function.
 *
 * @example
 * // Throttle a scroll event handler
 * window.addEventListener('scroll', throttle(() => {
 *   console.log('Scroll event handler called');
 * }, 200));
 */
export function throttle (fun, wait) {
  let lastCall = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastCall >= wait) {
      lastCall = now
      return fun.apply(this, args)
    }
  }
}
