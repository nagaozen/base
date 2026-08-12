import { describe, it } from 'node:test'
import assert from 'node:assert'

import { isCnpj } from './isCnpj.mjs'

describe('# isCnpj', () => {
  const valid = '90.018.299/0001-02'
  const invalid = '90.018.299/0001-82'

  // --- Numeric CNPJ (existing, unchanged) ---

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

  it('should return true for a valid CNPJ number without formatting', function () {
    assert.strictEqual(isCnpj(valid.replace(/\D/g, '')), true)
  })

  // --- Alphanumeric CNPJ (new format) ---

  it('should return true for a valid all-letter-base alphanumeric CNPJ', function () {
    assert.strictEqual(isCnpj('AAAAAAAAAAAA45'), true)
  })

  it('should return true for a valid mixed alphanumeric CNPJ', function () {
    assert.strictEqual(isCnpj('A1B2C3D4E5F668'), true)
  })

  it('should return true for a valid alphanumeric CNPJ that was previously rejected', function () {
    // '12.345.abc/0001-95' strips to '12345ABC000195', which has valid check digits
    assert.strictEqual(isCnpj('12.345.abc/0001-95'), true)
  })

  it('should return true for a valid alphanumeric CNPJ with formatting', function () {
    assert.strictEqual(isCnpj('AA.AAA.AAA/AAAA-45'), true)
  })

  it('should return true for a valid alphanumeric CNPJ in lowercase', function () {
    assert.strictEqual(isCnpj('aaaaaaaaaaaa45'), true)
  })

  it('should return false for an alphanumeric CNPJ with incorrect check digits', function () {
    assert.strictEqual(isCnpj('AAAAAAAAAAAA99'), false)
    assert.strictEqual(isCnpj('A1B2C3D4E5F600'), false)
  })

  it('should return false for an alphanumeric CNPJ with all identical characters', function () {
    assert.strictEqual(isCnpj('AAAAAAAAAAAAAA'), false)
  })

  it('should return false when check digits are not numeric', function () {
    assert.strictEqual(isCnpj('AAAAAAAAAAAA4A'), false)
    assert.strictEqual(isCnpj('AAAAAAAAAAAAAB'), false)
  })

  it('should return false for null, undefined, or empty input', function () {
    assert.strictEqual(isCnpj(null), false)
    assert.strictEqual(isCnpj(undefined), false)
    assert.strictEqual(isCnpj(''), false)
    assert.strictEqual(isCnpj('   '), false)
  })
})
