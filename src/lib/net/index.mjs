/**
 * Combines multiple AbortSignals into one.
 *
 * @param {AbortSignal[]} signals - An array of AbortSignals to combine.
 * @returns {AbortSignal} - A single AbortSignal that represents all the provided signals.
 */
export function composeAbortSignals (signals) {
  const ac = new AbortController()

  function onAbort () {
    if (!ac.signal.aborted) ac.abort()
    for (const signal of signals) {
      signal.removeEventListener('abort', onAbort)
    }
  }

  for (const signal of signals) {
    if (!signal) continue
    if (signal.aborted) {
      onAbort()
      break
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return ac.signal
}

/**
 * A resilient fetch function that adds timeout, retries with exponential backoff,
 * and supports multiple URLs with fallback options.
 *
 * @param {string|string[]} urls - A single URL or an array of URLs to attempt.
 * @param {object} [options] - Configuration options for the fetch operation.
 * @param {number} [options.timeout=0] - Timeout duration in milliseconds (0 for no timeout).
 * @param {number} [options.retries=0] - Number of retry attempts.
 * @param {number} [options.backoff=200] - Additional delay in milliseconds added to each backoff.
 * @param {number} [options.initialDelay=50] - Initial delay in milliseconds for exponential backoff.
 * @param {number} [options.baseDelay=2] - Base multiplier for exponential backoff.
 * @param {number} [options.maxDelay=120000] - Maximum delay in milliseconds (default 2 minutes).
 * @param {AbortSignal} [options.abortSignal] - An external AbortSignal to allow aborting the request.
 * @param {function} [options.assertFun] - A function to assert whether the response is acceptable.
 * @param {...any} [options.fetchOptions] - Additional options to pass to the fetch call.
 * @returns {Promise<Response>} - A Promise that resolves to the fetch Response.
 * @throws {Error} - Throws 'FETCH_ABORTED' if the request is aborted.
 * @throws {Error} - Throws 'FETCH_CATASTROPHIC_FAILURE' if all attempts fail.
 */
export async function resilientFetch (urls, options = {}) {
  if (!Array.isArray(urls)) urls = [urls]
  const {
    timeout = 0,
    retries = 0,
    backoff = 200,
    initialDelay = 50,
    baseDelay = 2,
    maxDelay = 120_000, // 2 minutes
    abortSignal,
    assertFun = function (response) {
      return response.ok
    },
    ...fetchOptions
  } = options

  const ac = new AbortController()
  const signals = [ac.signal]
  if (abortSignal) signals.push(abortSignal)
  const composedSignal = composeAbortSignals(signals)

  // timeout
  let timeoutId
  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      ac.abort()
    }, timeout)
  }

  let lastError
  let lastResponse

  try {
    // attempts with exponential backoff
    for (let attempt = 0; attempt <= retries; attempt++) {
      // a high available multi-region service may expose multiple urls
      for (const url of urls) {
        try {
          const response = await fetch(url, {
            ...fetchOptions,
            redirect: fetchOptions.redirect ?? 'error',
            signal: composedSignal
          })
          lastResponse = response
          // developers MAY customize how to handle 4xx and 5xx
          if (assertFun(response)) return response
        } catch (error) {
          if (composedSignal.aborted) throw new Error('FETCH_ABORTED', { cause: error })
          lastError = error
          // cors or network error
        }
      }
      if (attempt < retries) {
        const jitter = Math.random() * 0.5 + 0.75
        const retryDelay = Math.min(maxDelay, initialDelay * Math.pow(baseDelay, attempt + 1) * jitter + backoff)
        await delay(retryDelay, composedSignal)
      }
    }

    // unfortunately, everything failed
    const error = new Error('FETCH_CATASTROPHIC_FAILURE')
    error.cause = lastError
    error.response = lastResponse
    throw error
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * @typedef {object} ConfidentialAuthorization
 * @property {string} authorization
 * Authorization header value.
 * Example: "Bearer eyJ..."
 *
 * @property {number} expiresAt
 * Unix timestamp in milliseconds.
 */

/**
 * @typedef {object} ConfidentialClientOptions
 * @property {number} [timeout=900000]
 * @property {number} [retries=3]
 * @property {boolean} [retryUnsafeMethods=false]
 * @property {string} [authorizationHeaderName='Authorization']
 * @property {HeadersInit} [headers]
 * @property {boolean|Function} [refreshOnUnauthorized=false]
 * @property {(init: RequestInit) => void|Promise<void>} [beforeRequest]
 */

/**
 * Creates a confidential HTTP client using native fetch.
 *
 * Security model:
 * - baseURL is fixed and trusted.
 * - callers may only pass relative paths.
 * - Authorization is injected internally.
 * - redirects are disabled by default.
 * - retries avoid unsafe methods by default.
 * - request bodies are content-neutral.
 *
 * @param {() => Promise<ConfidentialAuthorization>} getAuthorizationFun
 * @param {string} baseURL
 * @param {ConfidentialClientOptions} [options]
 */
export function createConfidentialClient (
  getAuthorizationFun,
  baseURL,
  options = {}
) {
  if (typeof getAuthorizationFun !== 'function') throw new TypeError('getAuthorizationFun must be a function')
  assertTrustedBaseURL(baseURL)

  const {
    timeout = 900_000,
    retries = 3,
    retryUnsafeMethods = false,
    authorizationHeaderName = 'Authorization',
    headers = {},
    refreshOnUnauthorized = false,
    beforeRequest
  } = options

  let mutex = null
  const currentToken = {
    authorization: '',
    expiresAt: 0
  }
  async function updateToken () {
    const token = await getAuthorizationFun()
    if (!token || typeof token !== 'object') throw new Error('INVALID_TOKEN_RESULT')
    if (typeof token.authorization !== 'string' || token.authorization.length === 0) throw new Error('INVALID_TOKEN_AUTHORIZATION')
    if (typeof token.expiresAt !== 'number' || !Number.isFinite(token.expiresAt)) throw new Error('INVALID_TOKEN_EXPIRATION')

    currentToken.authorization = token.authorization
    currentToken.expiresAt = token.expiresAt
  }
  async function ensureToken (force = false) {
    const isExpired = currentToken.expiresAt <= Date.now()
    if (!force && !isExpired) return
    mutex ??= updateToken().finally(() => { mutex = null })
    try {
      await mutex
    } catch (e) {
      throw new Error('Authorization failed', { cause: e })
    }
  }

  async function request (path, unsafeInit = {}) {
    return _request(path, unsafeInit, false)
  }
  async function _request (path, unsafeInit = {}, alreadyRetriedAuth = false) {
    assertRelativePath(path)
    await ensureToken(false)
    const method = String(unsafeInit.method || 'GET').toUpperCase()
    const url = buildTrustedURL(baseURL, path)
    const requestHeaders = new Headers(headers)
    if (unsafeInit.headers) {
      const unsafeHeaders = new Headers(unsafeInit.headers)
      for (const [key, value] of unsafeHeaders.entries()) {
        requestHeaders.set(key, value)
      }
    }
    requestHeaders.set(authorizationHeaderName, currentToken.authorization)
    const body = prepareBody(unsafeInit.body, requestHeaders)
    const safeInit = {
      ...unsafeInit,
      method,
      headers: requestHeaders,
      body,
      redirect: unsafeInit.redirect ?? 'error'// IMPORTANT: SSRF hardening
    }
    if (typeof beforeRequest === 'function') {
      await beforeRequest(safeInit)
    }
    const response = await resilientFetch(url.href, {
      ...safeInit,
      timeout,
      retries: shouldRetryMethod(method, retryUnsafeMethods) ? retries : 0,
      assertFun: response => {
        if (response.status === 502) return false
        if (
          response.status >= 500 &&
          shouldRetryMethod(method, retryUnsafeMethods)
        ) {
          return false
        }
        return true
      }
    })
    if (
      response.status === 401 &&
      !alreadyRetriedAuth &&
      shouldRefreshOnUnauthorized(refreshOnUnauthorized, {
        response,
        path,
        init: unsafeInit
      })
    ) {
      await ensureToken(true)
      return _request(path, unsafeInit, true)
    }
    return response
  }
  return {
    request,
    get: (path, unsafeInit = {}) => request(path, { ...unsafeInit, method: 'GET' }),
    delete: (path, unsafeInit = {}) => request(path, { ...unsafeInit, method: 'DELETE' }),
    post: (path, body, unsafeInit = {}) => request(path, { ...unsafeInit, method: 'POST', body }),
    put: (path, body, unsafeInit = {}) => request(path, { ...unsafeInit, method: 'PUT', body }),
    patch: (path, body, unsafeInit = {}) => request(path, { ...unsafeInit, method: 'PATCH', body })
  }
}

function delay (ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('FETCH_ABORTED'))
      return
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    function onAbort () {
      cleanup()
      reject(new Error('FETCH_ABORTED'))
    }

    function cleanup () {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function assertTrustedBaseURL (baseURL) {
  const url = new URL(baseURL)
  if (url.protocol !== 'https:') throw new Error('BASE_URL_MUST_USE_HTTPS')
  if (!url.hostname) throw new Error('INVALID_BASE_URL')
  if (url.username || url.password) throw new Error('BASE_URL_CREDENTIALS_NOT_ALLOWED')
}

function assertRelativePath (path) {
  if (typeof path !== 'string') throw new Error('REQUEST_PATH_MUST_BE_STRING')
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('//')
  ) throw new Error('ABSOLUTE_REQUEST_URL_NOT_ALLOWED')
  if (!path.startsWith('/')) throw new Error('REQUEST_PATH_MUST_START_WITH_SLASH')
  if (path.includes('..')) throw new Error('REQUEST_PATH_TRAVERSAL_NOT_ALLOWED')
}

function buildTrustedURL (baseURL, path) {
  const url = new URL(path, baseURL)
  const base = new URL(baseURL)
  if (url.origin !== base.origin) throw new Error('REQUEST_ORIGIN_MISMATCH')
  return url
}

function shouldRetryMethod (method, retryUnsafeMethods) {
  if (retryUnsafeMethods) return true
  return ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method)
}

function shouldRefreshOnUnauthorized (refreshOnUnauthorized, context) {
  if (typeof refreshOnUnauthorized === 'function') return refreshOnUnauthorized(context)
  return refreshOnUnauthorized === true
}

function prepareBody (body, headers) {
  if (body == null) return undefined
  if (isBodyInit(body)) return body
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return JSON.stringify(body)
}

function isBodyInit (x) {
  return (
    typeof x === 'string' ||
    x instanceof ArrayBuffer ||
    ArrayBuffer.isView(x) ||
    x instanceof Blob ||
    x instanceof FormData ||
    x instanceof URLSearchParams ||
    isReadableStream(x) ||
    isNodeReadableStream(x)
  )
}

function isReadableStream (x) {
  return (
    x &&
    typeof x === 'object' &&
    typeof x.getReader === 'function'
  )
}

function isNodeReadableStream (x) {
  return (
    x &&
    typeof x === 'object' &&
    typeof x.pipe === 'function' &&
    typeof x.on === 'function'
  )
}
