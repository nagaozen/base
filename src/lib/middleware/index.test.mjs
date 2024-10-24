import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { compose } from './index.mjs'

describe('# compose', () => {
  it('should throw TypeError if middlewares is not an array', () => {
    assert.throws(() => {
      compose(null)
    }, {
      name: 'TypeError',
      message: 'middlewares stack MUST be an array!'
    })
  })

  it('should throw TypeError if middlewares contains non-function elements', () => {
    assert.throws(() => {
      compose([() => {}, 'not a function'])
    }, {
      name: 'TypeError',
      message: 'middlewares MUST be composed of functions!'
    })
  })

  it('should return a function', () => {
    const fn = compose([])
    assert.strictEqual(typeof fn, 'function')
  })

  it('should execute middleware functions in order', async () => {
    const calls = []
    const mw1 = async (ctx, next) => {
      calls.push('mw1 start')
      await next()
      calls.push('mw1 end')
    }
    const mw2 = async (ctx, next) => {
      calls.push('mw2 start')
      await next()
      calls.push('mw2 end')
    }
    const mw3 = async (ctx, next) => {
      calls.push('mw3')
    }
    const fn = compose([mw1, mw2, mw3])
    await fn({})
    assert.deepEqual(calls, [
      'mw1 start',
      'mw2 start',
      'mw3',
      'mw2 end',
      'mw1 end'
    ])
  })

  it('should work with synchronous middleware', async () => {
    const calls = []
    const mw1 = (ctx, next) => {
      calls.push('mw1 start')
      next()
      calls.push('mw1 end')
    }
    const mw2 = (ctx, next) => {
      calls.push('mw2')
      next()
    }
    const fn = compose([mw1, mw2])
    await fn({})
    assert.deepEqual(calls, [
      'mw1 start',
      'mw2',
      'mw1 end'
    ])
  })

  it('should handle errors thrown in middleware', async () => {
    const mw1 = async (ctx, next) => {
      throw new Error('Test error')
    }
    const mw2 = async (ctx, next) => {
      // This middleware should not be called
    }
    const fn = compose([mw1, mw2])
    await assert.rejects(
      async () => {
        await fn({})
      },
      (error) => {
        assert.strictEqual(error.message, 'Test error')
        return true
      }
    )
  })

  it('should handle errors in synchronous middleware', async () => {
    const mw1 = (ctx, next) => {
      throw new Error('Sync error')
    }
    const fn = compose([mw1])
    await assert.rejects(
      async () => {
        await fn({})
      },
      (error) => {
        assert.strictEqual(error.message, 'Sync error')
        return true
      }
    )
  })

  it('should execute the next function when middleware stack is empty', async () => {
    let called = false
    const next = async () => {
      called = true
    }
    const fn = compose([])
    await fn({}, next)
    assert.strictEqual(called, true)
  })

  it('should execute the next function after middleware stack', async () => {
    const calls = []
    const mw1 = async (ctx, next) => {
      calls.push('mw1')
      await next()
    }
    const next = async () => {
      calls.push('next')
    }
    const fn = compose([mw1])
    await fn({}, next)
    assert.deepEqual(calls, ['mw1', 'next'])
  })

  it('should throw error if next() is called multiple times', async () => {
    const mw1 = async (ctx, next) => {
      await next()
      await next()
    }
    const fn = compose([mw1])
    await assert.rejects(
      async () => {
        await fn({})
      },
      (error) => {
        assert.strictEqual(error.message, 'next() called multiple times')
        return true
      }
    )
  })

  it('should pass context between middleware', async () => {
    const mw1 = async (ctx, next) => {
      ctx.value = 1
      await next()
      ctx.value++
    }
    const mw2 = async (ctx, next) => {
      ctx.value *= 2
      await next()
    }
    const mw3 = async (ctx, next) => {
      ctx.value += 3
    }
    const ctx = {}
    const fn = compose([mw1, mw2, mw3])
    await fn(ctx)
    assert.strictEqual(ctx.value, 6) // ((1 * 2) + 3) + 1 = 6
  })

  it('should support nested compositions', async () => {
    const calls = []
    const mw1 = async (ctx, next) => {
      calls.push('mw1 start')
      await next()
      calls.push('mw1 end')
    }
    const mw2 = async (ctx, next) => {
      calls.push('mw2')
      await next()
    }
    const mw3 = async (ctx, next) => {
      calls.push('mw3')
    }
    const innerCompose = compose([mw2, mw3])
    const outerCompose = compose([mw1, innerCompose])
    await outerCompose({})
    assert.deepEqual(calls, [
      'mw1 start',
      'mw2',
      'mw3',
      'mw1 end'
    ])
  })

  it('should not proceed if middleware does not call next()', async () => {
    const calls = []
    const mw1 = async (ctx, next) => {
      calls.push('mw1')
      // Does not call next()
    }
    const mw2 = async (ctx, next) => {
      calls.push('mw2')
    }
    const fn = compose([mw1, mw2])
    await fn({})
    assert.deepEqual(calls, ['mw1'])
  })

  it('should handle middleware that returns non-Promise values', async () => {
    const calls = []
    const mw1 = (ctx, next) => {
      calls.push('mw1')
      return next()
    }
    const mw2 = (ctx, next) => {
      calls.push('mw2')
      return next()
    }
    const mw3 = (ctx, next) => {
      calls.push('mw3')
    }
    const fn = compose([mw1, mw2, mw3])
    await fn({})
    assert.deepEqual(calls, ['mw1', 'mw2', 'mw3'])
  })
})
