import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { traverse } from './index.mjs'

describe('# traverse', () => {
  it('should find a matching node in an object', async () => {
    const data = {
      id: 1,
      name: 'Alice',
      active: false,
      address: {
        city: 'Wonderland',
        zip: '12345'
      }
    }
    const visit = async (node, path) => {
      return node === 'Wonderland'
    }
    const result = await traverse(data, visit)// ?
    assert.deepEqual(result, {
      node: 'Wonderland',
      path: '$.address.city'
    })
  })

  it('should return undefined when no node matches', async () => {
    const data = {
      id: 1,
      name: 'Alice',
      active: false,
      address: {
        city: 'Wonderland',
        zip: '12345'
      }
    }
    const visit = async (node, path) => {
      return node === 'Neverland'
    }
    const result = await traverse(data, visit)
    assert.strictEqual(result, undefined)
  })

  it('should find a matching node in an array', async () => {
    const data = [
      { id: 1, name: 'Alice', active: false },
      { id: 2, name: 'Bob', active: true },
      { id: 3, name: 'Charlie', active: false }
    ]
    const visit = async (node, path) => {
      return node && node.active === true
    }
    const result = await traverse(data, visit)
    assert.deepEqual(result, {
      node: { id: 2, name: 'Bob', active: true },
      path: '$[1]'
    })
  })

  it('should find a matching node in a nested structure', async () => {
    const data = {
      group: {
        members: [
          { id: 1, name: 'Alice', active: false },
          { id: 2, name: 'Bob', active: true },
          { id: 3, name: 'Charlie', active: false }
        ]
      }
    }
    const visit = async (node, path) => {
      return node && node.active === true
    }
    const result = await traverse(data, visit)
    assert.deepEqual(result, {
      node: { id: 2, name: 'Bob', active: true },
      path: '$.group.members[1]'
    })
  })

  it('should stop traversal at the first match', async () => {
    const data = [1, 2, 3, 4, 5]
    let count = 0
    const visit = async (node, path) => {
      count++
      return node === 3
    }
    const result = await traverse(data, visit)
    assert.deepEqual(result, {
      node: 3,
      path: '$[2]'
    })
    assert.strictEqual(count, 4) // Visited nodes: root array, 1, 2, 3
  })

  it('should handle simple data types', async () => {
    const data = 42
    const visit = async (node, path) => {
      return node === 42
    }
    const result = await traverse(data, visit)
    assert.deepEqual(result, {
      node: 42,
      path: '$'
    })
  })

  it('should handle empty objects', async () => {
    const data = {}
    const visit = async (node, path) => {
      return false
    }
    const result = await traverse(data, visit)
    assert.strictEqual(result, undefined)
  })

  it('should handle empty arrays', async () => {
    const data = []
    const visit = async (node, path) => {
      return false
    }
    const result = await traverse(data, visit)
    assert.strictEqual(result, undefined)
  })

  it('should call visit with correct paths', async () => {
    const data = {
      a: {
        b: [
          { c: 1 },
          { c: 2 }
        ]
      }
    }
    const expectedPaths = [
      '$',
      '$.a',
      '$.a.b',
      '$.a.b[0]',
      '$.a.b[0].c',
      '$.a.b[1]',
      '$.a.b[1].c'
    ]
    const actualPaths = []
    const visit = async (node, path) => {
      actualPaths.push(path)
      return false
    }
    await traverse(data, visit)
    assert.deepEqual(actualPaths, expectedPaths)
  })

  it('should handle null and undefined nodes', async () => {
    const data = {
      a: null,
      b: undefined,
      c: {
        d: null
      }
    }
    const visitedNodes = []
    const visit = async (node, path) => {
      visitedNodes.push({ node, path })
      return false
    }
    await traverse(data, visit)
    assert.strictEqual(visitedNodes.length, 5)
    assert.deepEqual(visitedNodes[0], { node: data, path: '$' })
    assert.deepEqual(visitedNodes[1], { node: null, path: '$.a' })
    assert.deepEqual(visitedNodes[2], { node: undefined, path: '$.b' })
    assert.deepEqual(visitedNodes[3], { node: data.c, path: '$.c' })
    assert.deepEqual(visitedNodes[4], { node: null, path: '$.c.d' })
  })

  it('should throw TypeError if visit is not a function', async () => {
    const data = { a: 1 }
    const visit = null // NOT a function
    await assert.rejects(
      async () => {
        await traverse(data, visit)
      },
      {
        name: 'TypeError',
        message: 'visit is not a function'
      }
    )
  })
})
