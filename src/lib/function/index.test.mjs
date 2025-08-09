import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { setTimeout } from 'node:timers/promises'

import { debounce, memoize, throttle } from './index.mjs'

describe('# function', () => {
  describe('## debounce', () => {
    let callCount
    let debouncedFunction
    let context
    let argsPassed

    beforeEach(() => {
      callCount = 0
      context = null
      argsPassed = null
      const originalFunction = function (...args) {
        callCount++
        context = this
        argsPassed = args
      }
      debouncedFunction = debounce(originalFunction, 100)
    })

    afterEach(async () => {
      // Wait longer than the debounce delay to ensure all debounced functions have executed
      await setTimeout(200)
    })

    it('should not call the function immediately', () => {
      debouncedFunction()
      assert.strictEqual(callCount, 0)
    })

    it('should call the function after the delay', async () => {
      debouncedFunction()
      assert.strictEqual(callCount, 0)
      await setTimeout(150)
      assert.strictEqual(callCount, 1)
    })

    it('should reset the delay if called again before the delay has passed', async () => {
      debouncedFunction()
      await setTimeout(50)
      debouncedFunction()
      await setTimeout(50)
      debouncedFunction()
      await setTimeout(150)
      assert.strictEqual(callCount, 1)
    })

    it('should maintain the correct context (`this`)', async () => {
      const obj = {
        value: 42,
        method: debounce(function () {
          context = this
        }, 100)
      }
      obj.method()
      await setTimeout(150)
      assert.strictEqual(context, obj)
    })

    it('should pass the correct arguments', async () => {
      debouncedFunction(1, 2, 3)
      await setTimeout(150)
      assert.deepStrictEqual(argsPassed, [1, 2, 3])
    })

    it('should call the function only once for rapid successive calls', async () => {
      for (let i = 0; i < 5; i++) {
        debouncedFunction()
        await setTimeout(20)
      }
      await setTimeout(150)
      assert.strictEqual(callCount, 1)
    })

    it('should handle multiple independent debounced functions', async () => {
      let callCountA = 0
      let callCountB = 0
      const funcA = debounce(() => {
        callCountA++
      }, 100)
      const funcB = debounce(() => {
        callCountB++
      }, 100)
      funcA()
      funcB()
      funcA()
      funcB()
      await setTimeout(150)
      assert.strictEqual(callCountA, 1)
      assert.strictEqual(callCountB, 1)
    })

    it('should not call the function if never allowed to elapse', async () => {
      debouncedFunction()
      for (let i = 0; i < 5; i++) {
        await setTimeout(50)
        debouncedFunction()
      }
      await setTimeout(150)
      assert.strictEqual(callCount, 1)
    })

    it('should handle zero delay', async () => {
      let immediateCallCount = 0
      const immediateFunction = debounce(() => {
        immediateCallCount++
      }, 0)
      immediateFunction()
      assert.strictEqual(immediateCallCount, 0)
      await setTimeout(10)
      assert.strictEqual(immediateCallCount, 1)
    })

    it('should work with asynchronous functions', async () => {
      let result
      const asyncFunction = debounce(async () => {
        await setTimeout(50)
        result = 'done'
      }, 100)
      await asyncFunction()
      await setTimeout(150)
      assert.strictEqual(result, 'done')
    })

    it('should handle multiple rapid calls and execute once with the last arguments', async () => {
      debouncedFunction('first')
      debouncedFunction('second')
      debouncedFunction('third')
      await setTimeout(150)
      assert.strictEqual(callCount, 1)
      assert.deepStrictEqual(argsPassed, ['third'])
    })

    it('should not execute the function if not called', async () => {
      await setTimeout(150)
      assert.strictEqual(callCount, 0)
    })
  })

  describe('## memoize', () => {
    describe('basic caching behavior', () => {
      let calls
      let add
      let mAdd

      beforeEach(() => {
        calls = 0
        add = (a, b) => { calls++; return a + b }
        mAdd = memoize(add)
      })

      it('computes on first call and caches the result', () => {
        assert.strictEqual(mAdd(1, 2), 3)
        assert.strictEqual(calls, 1)
        assert.strictEqual(mAdd(1, 2), 3)
        assert.strictEqual(calls, 1)
      })

      it('distinguishes different primitive arguments', () => {
        mAdd(1, 2)
        mAdd(2, 3)
        assert.strictEqual(calls, 2)
      })

      it('uses reference identity for objects/functions', () => {
        const obj1 = { x: 1 }
        const obj2 = { x: 1 }
        const fn1 = () => 1
        const fn2 = () => 1

        const target = memoize((o, f) => { calls++; return o.x + f() })
        assert.strictEqual(target(obj1, fn1), 2)
        assert.strictEqual(target(obj1, fn1), 2) // cached
        assert.strictEqual(target(obj2, fn1), 2) // different object ref
        assert.strictEqual(target(obj1, fn2), 2) // different function ref
        assert.strictEqual(calls, 3)
      })

      it('supports multiple arguments and mixed types', () => {
        const f = memoize((a, b, c) => { calls++; return `${a}-${b.x}-${c}` })
        const obj = { x: 42 }
        assert.strictEqual(f(1, obj, 'z'), '1-42-z')
        assert.strictEqual(f(1, obj, 'z'), '1-42-z')
        assert.strictEqual(calls, 1)
      })

      it('NaN is a stable key (Map treats NaN === NaN for keys)', () => {
        const f = memoize((x) => { calls++; return Number.isNaN(x) ? 'nan' : 'num' })
        assert.strictEqual(f(NaN), 'nan')
        assert.strictEqual(f(NaN), 'nan') // cached
        assert.strictEqual(calls, 1)
      })

      it('handles undefined and null', () => {
        const f = memoize((a, b) => { calls++; return `${a}-${b}` })
        f(undefined, null)
        f(undefined, null)
        assert.strictEqual(calls, 1)
      })
    })

    describe('context (`this`) behavior', () => {
      it('executes with the caller `this` (via apply)', () => {
        let seenThis
        const f = memoize(function (x) {
          seenThis = this
          return x
        })
        const obj = { f }
        obj.f(1)
        assert.strictEqual(seenThis, obj)
      })

      it('DOES NOT include `this` in the cache key (documented behavior)', () => {
        const f = memoize(function (x) { return this.k * x })
        const a = { k: 2, f }
        const b = { k: 10, f }
        assert.strictEqual(a.f(3), 6)   // caches under args [3]
        assert.strictEqual(b.f(3), 6)   // reuses cache; not 30
      })
    })

    describe('async support', () => {
      it('caches the same Promise and avoids duplicate work', async () => {
        let calls = 0
        const slow = memoize(async (x) => {
          calls++
          await setTimeout(30)
          return x * 2
        })

        const p1 = slow(5)
        const p2 = slow(5)
        assert.strictEqual(p1, p2, 'should return the same Promise instance')
        const [r1, r2] = await Promise.all([p1, p2])
        assert.strictEqual(r1, 10)
        assert.strictEqual(r2, 10)
        assert.strictEqual(calls, 1)
      })
    })

    describe('TTL behavior', () => {
      it('ttl=0 (default) never expires and sweepExpired() returns 0', async () => {
        let calls = 0
        const f = memoize((x) => { calls++; return x * 3 })
        f(2)
        await setTimeout(50)
        f(2)
        assert.strictEqual(calls, 1)
        assert.strictEqual(f.sweepExpired(), 0)
      })

      it('entries expire after ttl and recompute on access', async () => {
        let calls = 0
        const f = memoize((x) => { calls++; return x + 1 }, { ttl: 40 })
        assert.strictEqual(f(10), 11)
        await setTimeout(25)
        assert.strictEqual(f(10), 11) // still fresh
        assert.strictEqual(calls, 1)
        await setTimeout(25)               // total ~50ms
        assert.strictEqual(f(10), 11) // recomputed
        assert.strictEqual(calls, 2)
      })

      it('sweepExpired removes expired entries proactively', async () => {
        let calls = 0
        const f = memoize((x) => { calls++; return x }, { ttl: 30 })

        // Create 3 distinct primitive-keyed entries
        f(1); f(2); f(3)
        assert.strictEqual(calls, 3)

        await setTimeout(40) // let them expire
        const removed = f.sweepExpired()
        assert.strictEqual(removed, 3)

        // After sweep, a call should recompute
        f(1)
        assert.strictEqual(calls, 4)
      })

      it('sweepExpired respects budget', async () => {
        const f = memoize((x) => x, { ttl: 20 })
        for (let i = 0; i < 5; i++) f(i)
        await setTimeout(30)
        const removedFirst = f.sweepExpired(3)
        const removedSecond = f.sweepExpired(3)
        assert.strictEqual(removedFirst, 3)
        assert.strictEqual(removedSecond, 2)
      })

      it('negative ttl effectively disables caching (expires immediately)', async () => {
        let calls = 0
        const f = memoize((x) => { calls++; return x }, { ttl: -1 })
        f('a')
        f('a')
        assert.strictEqual(calls, 2)
        assert.strictEqual(f.sweepExpired(), 1) // the single stale entry
      })
    })

    describe('maintenance methods', () => {
      it('clear() empties the cache', () => {
        let calls = 0
        const f = memoize((x) => { calls++; return x })
        f(1)
        assert.strictEqual(calls, 1)
        f.clear()
        f(1)
        assert.strictEqual(calls, 2)
      })

      it('exposes clear and sweepExpired as functions', () => {
        const f = memoize((x) => x)
        assert.strictEqual(typeof f.clear, 'function')
        assert.strictEqual(typeof f.sweepExpired, 'function')
      })
    })

    describe('error handling', () => {
      it('does not cache thrown errors', () => {
        let calls = 0
        let shouldThrow = true
        const f = memoize((x) => {
          calls++
          if (shouldThrow) throw new Error('boom')
          return x
        })

        assert.throws(() => f(1), /boom/)
        assert.strictEqual(calls, 1)

        shouldThrow = false
        assert.strictEqual(f(1), 1)
        assert.strictEqual(calls, 2)

        // Subsequent identical call should be cached
        assert.strictEqual(f(1), 1)
        assert.strictEqual(calls, 2)
      })
    })

    // No global timers to clean up; keep the hooks for symmetry with other suites
    beforeEach(() => { })
    afterEach(() => { })
  })

  describe('## throttle', () => {
    let callCount
    let throttledFunction
    let context
    let argsPassed

    beforeEach(() => {
      callCount = 0
      context = null
      argsPassed = null
      const originalFunction = function (...args) {
        callCount++
        context = this
        argsPassed = args
      }
      throttledFunction = throttle(originalFunction, 100)
    })

    afterEach(async () => {
      // Wait longer than the debounce delay to ensure all debounced functions have executed
      await setTimeout(200)
    })

    it('should call the function immediately on the first call', () => {
      throttledFunction()
      assert.strictEqual(callCount, 1)
    })

    it('should not call the function again within the wait period', async () => {
      throttledFunction()
      throttledFunction()
      throttledFunction()
      assert.strictEqual(callCount, 1)
      // Wait less than the wait period
      await setTimeout(50)
      throttledFunction()
      assert.strictEqual(callCount, 1)
    })

    it('should call the function again after the wait period', async () => {
      throttledFunction()
      await setTimeout(150)
      throttledFunction()
      assert.strictEqual(callCount, 2)
    })

    it('should maintain the correct context (`this`)', () => {
      const obj = {
        value: 42,
        method: throttle(function () {
          context = this
        }, 100)
      }
      obj.method()
      assert.strictEqual(context, obj)
    })

    it('should pass the correct arguments', () => {
      throttledFunction(1, 2, 3)
      assert.deepStrictEqual(argsPassed, [1, 2, 3])
    })

    it('should handle rapid calls and only execute as per throttle limit', async () => {
      for (let i = 0; i < 5; i++) {
        throttledFunction()
        await setTimeout(10)
      }
      assert.strictEqual(callCount, 1)
      await setTimeout(110)
      throttledFunction()
      assert.strictEqual(callCount, 2)
    })

    it('should not execute the function if called only within the wait period', async () => {
      throttledFunction()
      for (let i = 0; i < 5; i++) {
        await setTimeout(10)
        throttledFunction()
      }
      assert.strictEqual(callCount, 1)
    })

    it('should execute multiple times if wait periods have passed between calls', async () => {
      throttledFunction()
      await setTimeout(110)
      throttledFunction()
      await setTimeout(110)
      throttledFunction()
      assert.strictEqual(callCount, 3)
    })

    it('should return the result of the original function', () => {
      const originalFunction = (x) => x * 2
      const throttled = throttle(originalFunction, 100)
      const result = throttled(5)
      assert.strictEqual(result, 10)
    })

    it('should return undefined when the function is throttled (not called)', () => {
      const originalFunction = (x) => x * 2
      const throttled = throttle(originalFunction, 100)
      throttled(5) // First call
      const result = throttled(10) // Should be throttled
      assert.strictEqual(result, undefined)
    })
  })
})
