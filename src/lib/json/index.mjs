import { typeOf } from '../typeOf.mjs'

/**
 * Asynchronously traverses a tree-like structure (objects and arrays) and applies a visit function to each node.
 * The traversal stops and returns when the visit function returns a truthy value.
 *
 * @async
 * @function traverse
 * @param {*} node - The current node to process. Can be of any type.
 * @param {function} visit - An asynchronous function that is called with the current node and its path.
 *                           Should return a boolean or a Promise that resolves to a boolean.
 *                           If it returns a truthy value, the traversal stops.
 * @param {string} [path='$'] - The path to the current node in dot/bracket notation.
 * @returns {Promise<{node: *, path: string}|undefined>} If the visit function returns a truthy value,
 *          returns an object containing the matching node and its path.
 *          If the traversal completes without the visit function returning a truthy value, returns undefined.
 */
export async function traverse (node, visit, path = '$') {
  if (await visit(node, path)) { return ({ node, path }) }
  switch (typeOf(node)) {
    case 'object': {
      const keys = Object.keys(node)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const result = await traverse(node[key], visit, `${path}.${key}`)
        if (result) return result
      }
      break
    }
    case 'array': {
      for (let i = 0; i < node.length; i++) {
        const item = node[i]
        const result = await traverse(item, visit, `${path}[${i}]`)
        if (result) return result
      }
      break
    }
  }
}
