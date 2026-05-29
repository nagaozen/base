import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import { strict as assert } from 'node:assert'

import { resilientFetch, createConfidentialClient } from './index.mjs'

describe('# net', () => {
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

  describe('## createConfidentialClient', () => {
    let originalFetch
    let now

    beforeEach(() => {
      originalFetch = global.fetch
      now = Date.now()
    })

    afterEach(() => {
      global.fetch = originalFetch
      mock.restoreAll()
    })

    function authorizationFactory (authorization = 'Bearer test-token', expiresAt = now + 60_000) {
      return mock.fn(async () => ({
        authorization,
        expiresAt
      }))
    }

    it('sends a request to the trusted baseURL with Authorization header', async () => {
      const getAuthorization = authorizationFactory()

      global.fetch = mock.fn(async (url, init) => {
        assert.equal(url, 'https://api.example.com/cases')
        assert.equal(init.method, 'GET')
        assert.equal(init.redirect, 'error')
        assert.equal(init.headers.get('Authorization'), 'Bearer test-token')

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      const response = await client.get('/cases')

      assert.equal(await response.text(), 'OK')
      assert.equal(getAuthorization.mock.calls.length, 1)
      assert.equal(global.fetch.mock.calls.length, 1)
    })

    it('rejects absolute request URLs', async () => {
      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('https://evil.example.com/cases')
        },
        (error) => {
          assert.equal(error.message, 'ABSOLUTE_REQUEST_URL_NOT_ALLOWED')
          return true
        }
      )

      assert.equal(global.fetch, originalFetch)
    })

    it('rejects protocol-relative request URLs', async () => {
      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('//evil.example.com/cases')
        },
        (error) => {
          assert.equal(error.message, 'ABSOLUTE_REQUEST_URL_NOT_ALLOWED')
          return true
        }
      )
    })

    it('rejects paths that do not start with slash', async () => {
      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('cases')
        },
        (error) => {
          assert.equal(error.message, 'REQUEST_PATH_MUST_START_WITH_SLASH')
          return true
        }
      )
    })

    it('rejects path traversal-like paths', async () => {
      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('/../admin')
        },
        (error) => {
          assert.equal(error.message, 'REQUEST_PATH_TRAVERSAL_NOT_ALLOWED')
          return true
        }
      )
    })

    it('rejects non-https baseURL', () => {
      assert.throws(
        () => {
          createConfidentialClient(
            authorizationFactory(),
            'http://api.example.com'
          )
        },
        (error) => {
          assert.equal(error.message, 'BASE_URL_MUST_USE_HTTPS')
          return true
        }
      )
    })

    it('rejects baseURL with credentials', () => {
      assert.throws(
        () => {
          createConfidentialClient(
            authorizationFactory(),
            'https://user:pass@api.example.com'
          )
        },
        (error) => {
          assert.equal(error.message, 'BASE_URL_CREDENTIALS_NOT_ALLOWED')
          return true
        }
      )
    })

    it('caches authorization until expiresAt', async () => {
      const getAuthorization = authorizationFactory('Bearer cached-token', now + 60_000)

      global.fetch = mock.fn(async () => {
        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      await client.get('/one')
      await client.get('/two')

      assert.equal(getAuthorization.mock.calls.length, 1)
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('refreshes authorization when expired', async () => {
      let tokenCounter = 0

      const getAuthorization = mock.fn(async () => {
        tokenCounter++

        return {
          authorization: `Bearer token-${tokenCounter}`,
          expiresAt: tokenCounter === 1
            ? Date.now() + 10
            : Date.now() + 60_000
        }
      })

      global.fetch = mock.fn(async (url, init) => {
        return new Response(init.headers.get('Authorization'), { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      const firstResponse = await client.get('/cases')
      assert.equal(await firstResponse.text(), 'Bearer token-1')

      await new Promise(resolve => setTimeout(resolve, 20))

      const secondResponse = await client.get('/cases')
      assert.equal(await secondResponse.text(), 'Bearer token-2')

      assert.equal(getAuthorization.mock.calls.length, 2)
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('deduplicates concurrent authorization refreshes with a mutex', async () => {
      let resolveAuthorization

      const getAuthorization = mock.fn(() => {
        return new Promise(resolve => {
          resolveAuthorization = () => resolve({
            authorization: 'Bearer shared-token',
            expiresAt: Date.now() + 60_000
          })
        })
      })

      global.fetch = mock.fn(async (url, init) => {
        return new Response(init.headers.get('Authorization'), { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      const requests = Promise.all([
        client.get('/one'),
        client.get('/two'),
        client.get('/three')
      ])

      resolveAuthorization()

      const responses = await requests
      const bodies = await Promise.all(responses.map(response => response.text()))

      assert.deepEqual(bodies, [
        'Bearer shared-token',
        'Bearer shared-token',
        'Bearer shared-token'
      ])

      assert.equal(getAuthorization.mock.calls.length, 1)
      assert.equal(global.fetch.mock.calls.length, 3)
    })

    it('sets custom authorization header name', async () => {
      const getAuthorization = authorizationFactory('Token abc123')

      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.headers.get('X-Authorization'), 'Token abc123')
        assert.equal(init.headers.has('Authorization'), false)

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com',
        {
          authorizationHeaderName: 'X-Authorization'
        }
      )

      await client.get('/cases')
    })

    it('merges default and per-request headers', async () => {
      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.headers.get('X-Default'), 'default')
        assert.equal(init.headers.get('X-Request'), 'request')

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com',
        {
          headers: {
            'X-Default': 'default'
          }
        }
      )

      await client.get('/cases', {
        headers: {
          'X-Request': 'request'
        }
      })
    })

    it('serializes plain object bodies as JSON and sets Content-Type', async () => {
      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.method, 'POST')
        assert.equal(init.headers.get('Content-Type'), 'application/json')
        assert.equal(init.body, JSON.stringify({ name: 'Case A' }))

        return new Response('Created', { status: 201 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      const response = await client.post('/cases', { name: 'Case A' })

      assert.equal(response.status, 201)
    })

    it('does not overwrite explicit Content-Type for plain object bodies', async () => {
      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.headers.get('Content-Type'), 'application/vnd.api+json')
        assert.equal(init.body, JSON.stringify({ name: 'Case A' }))

        return new Response('Created', { status: 201 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await client.post('/cases', { name: 'Case A' }, {
        headers: {
          'Content-Type': 'application/vnd.api+json'
        }
      })
    })

    it('passes through string bodies without forcing Content-Type', async () => {
      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.body, 'raw text')
        assert.equal(init.headers.has('Content-Type'), false)

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await client.post('/text', 'raw text')
    })

    it('passes through URLSearchParams bodies', async () => {
      const params = new URLSearchParams()
      params.set('grant_type', 'client_credentials')

      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.body, params)
        assert.equal(init.headers.get('Content-Type'), 'application/x-www-form-urlencoded')

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await client.post('/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    })

    it('passes through FormData without forcing Content-Type', async () => {
      const form = new FormData()
      form.append('name', 'file')

      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.body, form)
        assert.equal(init.headers.has('Content-Type'), false)

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com'
      )

      await client.post('/upload', form)
    })

    it('calls beforeRequest before fetch', async () => {
      global.fetch = mock.fn(async (url, init) => {
        assert.equal(init.headers.get('X-Before-Request'), 'yes')

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com',
        {
          beforeRequest (init) {
            init.headers.set('X-Before-Request', 'yes')
          }
        }
      )

      await client.get('/cases')
    })

    it('does not retry POST by default', async () => {
      global.fetch = mock.fn(async () => {
        return new Response('Bad Gateway', { status: 502 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com',
        {
          retries: 2
        }
      )

      await assert.rejects(
        async () => {
          await client.post('/cases', { name: 'Case A' })
        },
        (error) => {
          assert.equal(error.message, 'FETCH_CATASTROPHIC_FAILURE')
          assert.equal(error.response.status, 502)
          return true
        }
      )

      assert.equal(global.fetch.mock.calls.length, 1)
    })

    it('retries GET on 502 by default', async () => {
      let callCount = 0

      global.fetch = mock.fn(async () => {
        callCount++

        if (callCount === 1) {
          return new Response('Bad Gateway', { status: 502 })
        }

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com',
        {
          retries: 1
        }
      )

      const response = await client.get('/cases')

      assert.equal(await response.text(), 'OK')
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('can retry unsafe methods when explicitly enabled', async () => {
      let callCount = 0

      global.fetch = mock.fn(async () => {
        callCount++

        if (callCount === 1) {
          return new Response('Bad Gateway', { status: 502 })
        }

        return new Response('Created', { status: 201 })
      })

      const client = createConfidentialClient(
        authorizationFactory(),
        'https://api.example.com',
        {
          retries: 1,
          retryUnsafeMethods: true
        }
      )

      const response = await client.post('/cases', { name: 'Case A' })

      assert.equal(await response.text(), 'Created')
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('does not refresh on 401 by default', async () => {
      const getAuthorization = authorizationFactory('Bearer token-1')

      global.fetch = mock.fn(async () => {
        return new Response('Unauthorized', { status: 401 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      const response = await client.get('/cases')

      assert.equal(response.status, 401)
      assert.equal(getAuthorization.mock.calls.length, 1)
      assert.equal(global.fetch.mock.calls.length, 1)
    })

    it('refreshes once on 401 when refreshOnUnauthorized is true', async () => {
      let tokenCounter = 0

      const getAuthorization = mock.fn(async () => {
        tokenCounter++

        return {
          authorization: `Bearer token-${tokenCounter}`,
          expiresAt: Date.now() + 60_000
        }
      })

      let requestCounter = 0

      global.fetch = mock.fn(async (url, init) => {
        requestCounter++

        if (requestCounter === 1) {
          assert.equal(init.headers.get('Authorization'), 'Bearer token-1')
          return new Response('Unauthorized', { status: 401 })
        }

        assert.equal(init.headers.get('Authorization'), 'Bearer token-2')
        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com',
        {
          refreshOnUnauthorized: true
        }
      )

      const response = await client.get('/cases')

      assert.equal(await response.text(), 'OK')
      assert.equal(getAuthorization.mock.calls.length, 2)
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('supports refreshOnUnauthorized as a predicate function', async () => {
      let tokenCounter = 0

      const getAuthorization = mock.fn(async () => {
        tokenCounter++

        return {
          authorization: `Bearer token-${tokenCounter}`,
          expiresAt: Date.now() + 60_000
        }
      })

      let requestCounter = 0

      global.fetch = mock.fn(async () => {
        requestCounter++

        if (requestCounter === 1) {
          return new Response('Unauthorized', {
            status: 401,
            headers: {
              'www-authenticate': 'Bearer error="invalid_token"'
            }
          })
        }

        return new Response('OK', { status: 200 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com',
        {
          refreshOnUnauthorized: ({ response }) => {
            return response.headers
              .get('www-authenticate')
              ?.includes('invalid_token')
          }
        }
      )

      const response = await client.get('/cases')

      assert.equal(response.status, 200)
      assert.equal(getAuthorization.mock.calls.length, 2)
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('does not refresh more than once for a repeated 401', async () => {
      const getAuthorization = mock.fn(async () => ({
        authorization: 'Bearer token',
        expiresAt: Date.now() + 60_000
      }))

      global.fetch = mock.fn(async () => {
        return new Response('Unauthorized', { status: 401 })
      })

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com',
        {
          refreshOnUnauthorized: true
        }
      )

      const response = await client.get('/cases')

      assert.equal(response.status, 401)
      assert.equal(getAuthorization.mock.calls.length, 2)
      assert.equal(global.fetch.mock.calls.length, 2)
    })

    it('throws when getAuthorizationFun returns an invalid result', async () => {
      const getAuthorization = mock.fn(async () => null)

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('/cases')
        },
        (error) => {
          assert.equal(error.message, 'Authorization failed')
          assert.equal(error.cause.message, 'INVALID_TOKEN_RESULT')
          return true
        }
      )
    })

    it('throws when authorization is empty', async () => {
      const getAuthorization = mock.fn(async () => ({
        authorization: '',
        expiresAt: Date.now() + 60_000
      }))

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('/cases')
        },
        (error) => {
          assert.equal(error.message, 'Authorization failed')
          assert.equal(error.cause.message, 'INVALID_TOKEN_AUTHORIZATION')
          return true
        }
      )
    })

    it('throws when expiresAt is invalid', async () => {
      const getAuthorization = mock.fn(async () => ({
        authorization: 'Bearer token',
        expiresAt: Number.NaN
      }))

      const client = createConfidentialClient(
        getAuthorization,
        'https://api.example.com'
      )

      await assert.rejects(
        async () => {
          await client.get('/cases')
        },
        (error) => {
          assert.equal(error.message, 'Authorization failed')
          assert.equal(error.cause.message, 'INVALID_TOKEN_EXPIRATION')
          return true
        }
      )
    })
  })
})
