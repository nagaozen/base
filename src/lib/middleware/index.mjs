/**
 * Composes an array of middleware functions into a single middleware.
 *
 * @param {Function[]} middlewares - An array of middleware functions.
 * @returns {Function} A composed middleware function that takes context and next.
 * @throws {TypeError} If middlewares is not an array of functions.
 */
export function compose (middlewares) {
  if (!Array.isArray(middlewares)) {
    throw new TypeError('middlewares stack MUST be an array!')
  }
  for (const middleware of middlewares) {
    if (typeof middleware !== 'function') {
      throw new TypeError('middlewares MUST be composed of functions!')
    }
  }
  return function (context, next = () => Promise.resolve()) {
    let index = -1
    function dispatch (i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'))
      }
      index = i
      const middleware = i < middlewares.length ? middlewares[i] : next
      if (!middleware) {
        return Promise.resolve()
      }
      try {
        return Promise.resolve(middleware(context, dispatch.bind(null, i + 1)))
      } catch (err) {
        return Promise.reject(err)
      }
    }
    return dispatch(0)
  }
}
