import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { load, loadSchema } from './index.mjs'

describe('# jsonschema', () => {
  describe('## load', () => {
    const mockProviders = {
      http: async function mockHttpProvider (url) {
        // Mock schema data based on URL
        const schemas = {
          'http://example.com/root.schema.json': {
            $id: 'http://example.com/root.schema.json',
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: { $ref: 'address.schema.json' }
            }
          },
          'http://example.com/address.schema.json': {
            $id: 'http://example.com/address.schema.json',
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            }
          },
          'http://example.com/root.en-US.json': {
            'properties.name.description': 'Full name',
            'properties.address.description': 'Address information'
          },
          'http://example.com/address.en-US.json': {
            'properties.street.description': 'Street name',
            'properties.city.description': 'City name'
          }
        }
        return schemas[url] ?? false
      }
    }

    it('should load a schema and resolve $ref references', async () => {
      const options = {
        lang: 'en-US',
        providers: mockProviders
      }
      const result = await load('root.schema.json', 'http://example.com/', options)
      const expectedSchema = {
        $defs: {
          'root.schema.json': {
            $id: 'http://example.com/root.schema.json',
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Full name' },
              address: {
                $ref: '#/$defs/address.schema.json',
                description: 'Address information'
              }
            }
          },
          'address.schema.json': {
            $id: 'http://example.com/address.schema.json',
            type: 'object',
            properties: {
              street: { type: 'string', description: 'Street name' },
              city: { type: 'string', description: 'City name' }
            }
          }
        },
        $ref: '#/$defs/root.schema.json'
      }
      assert.deepStrictEqual(result, expectedSchema)
    })

    it('should handle missing localization files gracefully', async () => {
      const options = {
        lang: 'fr-FR', // Localization file does not exist
        providers: mockProviders
      }
      const result = await load('root.schema.json', 'http://example.com/', options)
      const expectedSchema = {
        $defs: {
          'root.schema.json': {
            $id: 'http://example.com/root.schema.json',
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: { $ref: '#/$defs/address.schema.json' }
            }
          },
          'address.schema.json': {
            $id: 'http://example.com/address.schema.json',
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            }
          }
        },
        $ref: '#/$defs/root.schema.json'
      }
      assert.deepStrictEqual(result, expectedSchema)
    })

    it('should throw an error for unsupported protocols', async () => {
      const options = {
        providers: mockProviders
      }
      await assert.rejects(
        async () => {
          await load('root.schema.json', 'ftp://example.com/', options)
        },
        {
          name: 'Error',
          message: 'JSONSCHEMA_LOADER_PROTOCOL_FTP_NOT_IMPLEMENTED'
        }
      )
    })
  })

  describe('## loadSchema', () => {
    it('should error on unsupported protocol', async () => {
      await assert.rejects(
        () => loadSchema('ftp://example.com/schema.json', 'http://example.com/', { lang: 'en-US', providers: {} }),
        {
          name: 'Error',
          message: 'JSONSCHEMA_LOADER_PROTOCOL_FTP_NOT_IMPLEMENTED'
        }
      )
    })
  })
})
