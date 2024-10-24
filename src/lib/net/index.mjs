/**
 * Combines multiple AbortSignals into one.
 *
 * @param {AbortSignal[]} signals - An array of AbortSignals to combine.
 * @returns {AbortSignal} - A single AbortSignal that represents all the provided signals.
 */
export function composeAbortSignals (signals) {
  const ac = new AbortController()

  function onAbort () {
    ac.abort()
    signals.forEach(signal => signal.removeEventListener('abort', onAbort))
  }

  signals.forEach(signal => {
    if (signal.aborted) {
      onAbort()
    } else {
      signal.addEventListener('abort', onAbort)
    }
  })

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
    maxDelay = 120000, // 2 minutes
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

  try {
    // attempts with exponential backoff
    for (let attempt = 0; attempt <= retries; attempt++) {
      // a high available multi-region service may expose multiple urls
      for (let i = 0, len = urls.length; i < len; i++) {
        const url = urls[i]
        try {
          const response = await fetch(url, { ...fetchOptions, signal: composedSignal })
          // developers MAY customize how to handle 4xx and 5xx
          if (assertFun(response)) return response
        } catch (error) {
          if (composedSignal.aborted) throw new Error('FETCH_ABORTED')
          // cors or network error
        }
      }
      if (attempt < retries) {
        const jitter = Math.random() * 0.5 + 0.75
        const delay = Math.min(maxDelay, initialDelay * Math.pow(baseDelay, attempt + 1) * jitter + backoff)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // unfortunately, everything failed
    throw new Error('FETCH_CATASTROPHIC_FAILURE')
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
