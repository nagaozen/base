import { describe, it } from 'node:test'
import assert from 'node:assert'

import { isCpf } from './isCpf.mjs'

describe('# isCpf', () => {
  const valid = '280.584.590-03'
  const invalid = '280.584.590-42'

  it('should return true for a valid CPF number', () => {
    assert.strictEqual(isCpf(valid), true)
  })

  it('should return false for an invalid CPF number', function () {
    assert.strictEqual(isCpf(invalid), false)
  })

  it('should return false for a CPF number with all identical digits', function () {
    assert.strictEqual(isCpf('111.111.111-11'), false)
  })

  it('should return false for a CPF number with incorrect length', function () {
    assert.strictEqual(isCpf('123.456.789'), false)
    assert.strictEqual(isCpf('123.456.789-1234'), false)
  })

  it('should return false for a CPF number with non-digit characters', function () {
    assert.strictEqual(isCpf('123.abc.789-09'), false)
  })

  it('should return true for a valid CPF number without formatting', function () {
    assert.strictEqual(isCpf(valid.replace(/\D/g, '')), true)
  })
})
