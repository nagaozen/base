import { describe, it } from 'node:test'
import assert from 'node:assert'

import { isCnpj } from './isCnpj.mjs'

describe('# isCnpj', () => {
  const valid = '90.018.299/0001-02'
  const invalid = '90.018.299/0001-82'

  it('should return true for a valid CNPJ number', function () {
    assert.strictEqual(isCnpj(valid), true)
  })

  it('should return false for an invalid CNPJ number', function () {
    assert.strictEqual(isCnpj(invalid), false)
  })

  it('should return false for a CNPJ number with all identical digits', function () {
    assert.strictEqual(isCnpj('11.111.111/1111-11'), false)
  })

  it('should return false for a CNPJ number with incorrect length', function () {
    assert.strictEqual(isCnpj('12.345.678/0001'), false)
    assert.strictEqual(isCnpj('12.345.678/0001-95123'), false)
  })

  it('should return false for a CNPJ number with non-digit characters', function () {
    assert.strictEqual(isCnpj('12.345.abc/0001-95'), false)
  })

  it('should return true for a valid CNPJ number without formatting', function () {
    assert.strictEqual(isCnpj(valid.replace(/\D/g, '')), true)
  })
})
