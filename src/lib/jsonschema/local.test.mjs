import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { load } from './index.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('# jsonschema local loader', () => {
  const providers = {
    file: async function schemaFromFile(url) {
      const path = fileURLToPath(url)
      const content = await readFile(path, 'utf-8')
      return JSON.parse(content)
    }
  }

  it('should load and resolve root schema files', async () => {
    const basepath = `file://${join(__dirname, '__fixtures__', 'schemas')}/`
    const result = await load('root.schema.json', basepath, { providers })

    // Expected resolved schema structure
    const expected = {
      $defs: {
        'root.schema.json': {
          $id: 'root.schema.json',
          type: 'object',
          properties: {
            person: {
              $ref: '#/$defs/person.schema.json'
            }
          },
          required: ['person']
        },
        'person.schema.json': {
          $id: 'person.schema.json',
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
            address: {
              $ref: '#/$defs/address.schema.json'
            }
          },
          required: ['name', 'address']
        },
        'address.schema.json': {
          $id: 'address.schema.json',
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            country: { type: 'string' }
          },
          required: ['street', 'city']
        }
      },
      $ref: '#/$defs/root.schema.json'
    }

    assert.deepEqual(result, expected)
  })

  it('should load and resolve all schemas', async () => {
    const options = {
      lang: 'pt-BR', 
      providers
    }
    const basepath = `file://${join(__dirname, '__fixtures__', 'schemas')}/`
    
    const schemaList = await readFile(join(__dirname, '__fixtures__', 'schemas', 'to-do-resolve.example.txt'), 'utf8')
    const schemas = schemaList
      .split('\n')
    
    for (const schema of schemas) {
      console.log(`schema loaded: ${schema}`) 
      const result = await load(schema, basepath, options)
      assert.ok(result.$defs)
      assert.ok(result.$ref)
    }
  })
}) 