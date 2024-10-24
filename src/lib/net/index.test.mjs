import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import { strict as assert } from 'node:assert'

import { resilientFetch } from './index.mjs'

describe('# web', () => {
  describe('## resilientFetch', () => {
    let originalFetch

    beforeEach(() => {
      // Save the original fetch function
      originalFetch = global.fetch
    })

    afterEach(() => {
      // Restore the original fetch function
      global.fetch = originalFetch
    })

    it('succeeds on first attempt with a 2xx response', async () => {
      global.fetch = mock.fn(async () => new Response('Success', { status: 200 }))
      const response = await resilientFetch('https://example.com', {
        method: 'GET'
      })
      assert.equal(await response.text(), 'Success')
      assert.equal(global.fetch.mock.calls.length, 1)
    })

    it('retries on network error and succeeds', async () => {
      let callCount = 0
      global.fetch = mock.fn(async () => {
        if (callCount === 0) {
          callCount++
          throw new Error('Network Error')
        } else {
          return new Response('Success', { status: 200 })
        }
      })
      const response = await resilientFetch('https://example.com', {
        retries: 1,
        method: 'GET'
      })
      assert.equal(await response.text(), 'Success')
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('retries on 5xx response and succeeds', async () => {
      let callCount = 0
      global.fetch = mock.fn(async () => {
        if (callCount === 0) {
          callCount++
          return new Response('Server Error', { status: 500 })
        } else {
          return new Response('Success', { status: 200 })
        }
      })
      const response = await resilientFetch('https://example.com', {
        retries: 1,
        method: 'GET',
        assertFun: (response) => response.ok
      })
      assert.equal(await response.text(), 'Success')
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('gives up after retries are exhausted', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('Network Error')
      })
      await assert.rejects(
        async () => {
          await resilientFetch('https://example.com', {
            retries: 2,
            method: 'GET'
          })
        },
        (error) => {
          assert.equal(error.message, 'FETCH_CATASTROPHIC_FAILURE')
          return true
        }
      )
      assert.equal(global.fetch.mock.calls.length, 3) // Initial attempt + 2 retries
    })

    it('respects the timeout option', async () => {
      global.fetch = mock.fn((url, options) => {
        return new Promise((resolve, reject) => {
          const { signal } = options
          if (signal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          } else {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          }
          // Simulate a delayed response that would resolve after 100ms
          setTimeout(() => resolve(new Response('Delayed', { status: 200 })), 100)
        })
      })

      await assert.rejects(
        async () => {
          await resilientFetch('https://example.com', {
            timeout: 50,
            method: 'GET'
          })
        },
        (error) => {
          assert.equal(error.message, 'FETCH_ABORTED')
          return true
        }
      )
    })

    it('can be aborted externally', async () => {
      const controller = new AbortController()
      global.fetch = mock.fn((url, options) => {
        return new Promise((resolve, reject) => {
          const { signal } = options
          if (signal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          } else {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          }
          // Simulate an ongoing request that never resolves unless aborted
        })
      })
      setTimeout(() => controller.abort(), 50)
      await assert.rejects(
        async () => {
          await resilientFetch('https://example.com', {
            abortSignal: controller.signal,
            method: 'GET'
          })
        },
        (error) => {
          assert.equal(error.message, 'FETCH_ABORTED')
          return true
        }
      )
    })

    it('cycles through multiple URLs', async () => {
      global.fetch = mock.fn(async (url) => {
        if (url === 'https://primary.example.com') {
          throw new Error('Network Error')
        } else if (url === 'https://secondary.example.com') {
          return new Response('Secondary Success', { status: 200 })
        } else {
          // Handle any other URLs to prevent pending Promises
          throw new Error(`Unexpected URL: ${url}`)
        }
      })
      const response = await resilientFetch(
        ['https://primary.example.com', 'https://secondary.example.com'],
        {
          method: 'GET'
        }
      )
      assert.equal(await response.text(), 'Secondary Success')
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('applies exponential backoff with jitter', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('Network Error')
      })
      const startTime = Date.now()
      await assert.rejects(
        async () => {
          await resilientFetch('https://example.com', {
            retries: 2,
            initialDelay: 50,
            baseDelay: 2,
            maxDelay: 200,
            method: 'GET'
          })
        },
        (error) => {
          assert.equal(error.message, 'FETCH_CATASTROPHIC_FAILURE')
          return true
        }
      )
      const elapsedTime = Date.now() - startTime
      assert(elapsedTime >= 50) // Should be at least the initial delay
      assert(elapsedTime <= 1000) // Should not exceed maxDelay * retries
    })
  })
})
