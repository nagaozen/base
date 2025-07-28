import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  asciiFrom,
  constFrom,
  camelCaseFrom,
  kebabCaseFrom,
  pascalCaseFrom,
  snakeCaseFrom
} from './index.mjs'

describe('# text', () => {
  describe('## asciiFrom', () => {
    it('should gracefully handle non-strings', () => {
      assert.strictEqual(asciiFrom(undefined), '')
      assert.strictEqual(asciiFrom(null), '')
      assert.strictEqual(asciiFrom(true), '')
      assert.strictEqual(asciiFrom(false), '')
      assert.strictEqual(asciiFrom(42), '')
      assert.strictEqual(asciiFrom([]), '')
      assert.strictEqual(asciiFrom({}), '')
    })

    it('should convert using compatibility normalization', () => {
      assert.strictEqual(asciiFrom('ﬀ Ⓓ'), 'ff D')
    })

    it('should remove diatrics', () => {
      assert.strictEqual(asciiFrom('áéíóú âêîôû àèìòù ãõñ äëïöü ç'), 'aeiou aeiou aeiou aon aeiou c')
    })
  })

  describe('## constFrom', () => {
    it('should convert a string to constant format', async () => {
      assert.strictEqual(constFrom('Hello World'), 'HELLO_WORLD')
      assert.strictEqual(constFrom('  multiple   spaces  '), 'MULTIPLE_SPACES')
      assert.strictEqual(constFrom('Special!@# Chars'), 'SPECIAL_CHARS')
    })
  })

  describe('## camelCaseFrom', () => {
    it('should convert a string to camel case', async () => {
      assert.strictEqual(camelCaseFrom('Hello World'), 'helloWorld')
      assert.strictEqual(camelCaseFrom('  multiple   spaces  '), 'multipleSpaces')
      assert.strictEqual(camelCaseFrom('Special!@# Chars'), 'specialChars')
    })
  })

  describe('## kebabCaseFrom', () => {
    it('should convert a string to kebab case', async () => {
      assert.strictEqual(kebabCaseFrom('Hello World'), 'hello-world')
      assert.strictEqual(kebabCaseFrom('  multiple   spaces  '), 'multiple-spaces')
      assert.strictEqual(kebabCaseFrom('Special!@# Chars'), 'special-chars')
    })
  })

  describe('## pascalCaseFrom', () => {
    it('should convert a string to pascal case', async () => {
      assert.strictEqual(pascalCaseFrom('Hello World'), 'HelloWorld')
      assert.strictEqual(pascalCaseFrom('  multiple   spaces  '), 'MultipleSpaces')
      assert.strictEqual(pascalCaseFrom('Special!@# Chars'), 'SpecialChars')
    })
  })

  describe('## snakeCaseFrom', () => {
    it('should convert a string to snake case', async () => {
      assert.strictEqual(snakeCaseFrom('Hello World'), 'hello_world')
      assert.strictEqual(snakeCaseFrom('  multiple   spaces  '), 'multiple_spaces')
      assert.strictEqual(snakeCaseFrom('Special!@# Chars'), 'special_chars')
    })
  })
})
