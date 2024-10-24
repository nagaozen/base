import { describe, it } from 'node:test'
import assert from 'node:assert'

import { micromustache } from './micromustache.mjs'

describe('# micromustache', () => {
  it('should replace placeholders with corresponding values from the data source', () => {
    const template = 'Hello, {{name}}!'
    const datasource = { name: 'World' }
    assert.strictEqual(micromustache(template, datasource), 'Hello, World!')
  })

  it('should leave placeholders unchanged if there is no corresponding value in the data source', () => {
    const template = 'Hello, {{name}}! Today is {{day}}.'
    const datasource = { name: 'Alice' }
    assert.strictEqual(micromustache(template, datasource), 'Hello, Alice! Today is {{day}}.')
  })

  it('should work with multiple placeholders', () => {
    const template = '{{greeting}}, {{name}}! Today is {{day}}.'
    const datasource = { greeting: 'Hi', name: 'Bob', day: 'Monday' }
    assert.strictEqual(micromustache(template, datasource), 'Hi, Bob! Today is Monday.')
  })

  it('should handle missing data source gracefully', () => {
    const template = 'Hello, {{name}}!'
    assert.strictEqual(micromustache(template, {}), 'Hello, {{name}}!')
  })

  it('should handle empty template gracefully', () => {
    const template = ''
    const datasource = { name: 'Alice' }
    assert.strictEqual(micromustache(template, datasource), '')
  })

  it('should handle template with no placeholders', () => {
    const template = 'Hello, World!'
    const datasource = { name: 'Alice' }
    assert.strictEqual(micromustache(template, datasource), 'Hello, World!')
  })

  it('should handle placeholders with special characters', () => {
    const template = 'Value: {{value$1}}'
    const datasource = { value$1: '123' }
    assert.strictEqual(micromustache(template, datasource), 'Value: 123')
  })

  it('should handle whitespace inside placeholders', () => {
    const template = 'Hello, {{ name }}!'
    const datasource = { name: 'Charlie' }
    assert.strictEqual(micromustache(template, datasource), 'Hello, Charlie!')
  })
})
