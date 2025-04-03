import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { load, loadSchema } from './index.mjs'

async function schemaFromFileSystem (url, options) {
  const json = await readFile(fileURLToPath(url), { encoding: 'utf8' })
  return JSON.parse(json)
}

describe('# jsonschema', () => {
  describe('## load', () => {
    // MARK: mocked
    const mockProviders = {
      http: async function mockHttpProvider (url, options) {
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
          },
          'http://example.com/scim.schema.json': {
            $id: 'http://example.com/scim.schema.json',
            type: 'object',
            properties: {
              $ref: {
                type: 'string',
                format: 'uri'
              }
            }
          }
        }

        let schema = schemas[url] ?? false
        if (schema && options && options.requestId) {
          schema = { ...schema, requestId: options.requestId }
        }
        return schema
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

    it('should forward options to the provider function', async () => {
      const options = {
        providers: mockProviders,
        lang: 'en-US',
        // other options
        requestId: 'example'
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
            },
            requestId: 'example'
          },
          'address.schema.json': {
            $id: 'http://example.com/address.schema.json',
            type: 'object',
            properties: {
              street: { type: 'string', description: 'Street name' },
              city: { type: 'string', description: 'City name' }
            },
            requestId: 'example'
          }
        },
        $ref: '#/$defs/root.schema.json'
      }

      assert.deepStrictEqual(result, expectedSchema)
    })

    it('should resolve $ref as jsonschema properties', async () => {
      const options = {
        providers: mockProviders,
        lang: 'en-US',
        // other options
        requestId: 'example'
      }
      const result = await load('scim.schema.json', 'http://example.com/', options)
      const expectedSchema = {
        $defs: {
          'scim.schema.json': {
            $id: 'http://example.com/scim.schema.json',
            type: 'object',
            properties: {
              $ref: {
                type: 'string',
                format: 'uri'
              }
            },
            requestId: 'example'
          }
        },
        $ref: '#/$defs/scim.schema.json'
      }

      assert.deepStrictEqual(result, expectedSchema)
    })

    // MARK: local files
    const BASEPATH = import.meta.url

    const providers = {
      file: async function (url, options) {
        return schemaFromFileSystem(url, options)
      }
    }

    it('should resolve complex jsonschema #refs', async () => {
      const options = {
        providers,
        lang: 'en-US'
      }
      const result = await load('schemata/SCIMv2/User.1.0.schema.json', BASEPATH, options)
      const expectedSchema = {
        $defs: {
          'schemata:SCIMv2:User.1.0.schema.json': {
            title: 'User',
            description: 'SCIM provides a resource type for `User` resources.',
            type: 'object',
            allOf: [{
              $ref: '#/$defs/schemata:SCIMv2:Resource.1.0.schema.json'
            }, {
              properties: {
                userName: {
                  type: 'string',
                  description: 'Unique identifier for the User, typically used by the user to directly authenticate to the service provider. Each User MUST include a non-empty userName value.  This identifier MUST be unique across the service provider`s entire set of Users. REQUIRED.'
                },
                name: {
                  oneOf: [{
                    type: 'string'
                  }, {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:name'
                  }],
                  description: 'The full name, including all middle names, titles, and suffixes as appropriate, formatted for display (e.g., `Ms. Barbara J Jensen, III`).'
                },
                displayName: {
                  type: 'string',
                  description: 'The name of the User, suitable for display to end-users.  The name SHOULD be the full name of the User being described, if known.'
                },
                nickName: {
                  type: 'string',
                  description: 'The casual way to address the user in real life, e.g., `Bob` or `Bobby` instead of `Robert`.  This attribute SHOULD NOT be used to represent a User`s username (e.g., `bjensen` or `mpepperidge`).'
                },
                profileUrl: {
                  type: 'string',
                  description: 'A fully qualified URL pointing to a page representing the User`s online profile.'
                },
                title: {
                  type: 'string',
                  description: 'The user`s title, such as `Vice President.`'
                },
                userType: {
                  type: 'string',
                  description: 'Used to identify the relationship between the organization and the user.  Typical values used might be `Contractor`, `Employee`, `Intern`, `Temp`, `External`, and `Unknown`, but any value may be used.'
                },
                preferredLanguage: {
                  type: 'string',
                  description: 'Indicates the User`s preferred written or spoken language.  Generally used for selecting a localized user interface; e.g., `en_US` specifies the language English and country as defined in [RFC7231].'
                },
                locale: {
                  type: 'string',
                  description: 'Used to indicate the User`s default location for purposes of localizing items such as currency, date time format, or numerical representations.  A valid value is a language tag as defined in [RFC5646].'
                },
                timezone: {
                  type: 'string',
                  description: 'The User`s time zone, in IANA Time Zone database format [RFC6557].'
                },
                active: {
                  type: 'boolean',
                  description: 'A Boolean value indicating the User`s administrative status.',
                  default: true
                },
                password: {
                  type: 'string',
                  description: 'The User`s cleartext password.  This attribute is intended to be used as a means to specify an initial password when creating a new User or to reset an existing User`s password.'
                },
                emails: {
                  type: 'array',
                  description: 'Email addresses for the User.  The value SHOULD be specified according to [RFC5321].',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:email'
                  }
                },
                phoneNumbers: {
                  type: 'array',
                  description: 'Phone numbers for the user.  The value SHOULD be specified according to the format defined in [RFC3966]',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:phoneNumber'
                  }
                },
                ims: {
                  type: 'array',
                  description: 'Instant messaging address for the user.  No official canonicalization rules exist for all instant messaging addresses, but service providers SHOULD, when appropriate, remove all whitespace and convert the address to lowercase.',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:im'
                  }
                },
                photos: {
                  type: 'array',
                  description: 'A URI that is a uniform resource locator (as defined in Section 1.1.3 of [RFC3986]) that points to a resource location representing the user`s image.',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:photo'
                  }
                },
                addresses: {
                  type: 'array',
                  description: 'A physical mailing address for this user.',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:address'
                  }
                },
                groups: {
                  type: 'array',
                  description: 'A list of groups to which the user belongs, either through direct membership, through nested groups, or dynamically calculated.',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:group'
                  }
                },
                entitlements: {
                  type: 'array',
                  description: 'A list of entitlements for the user that represent a thing the user has.  An entitlement may be an additional right to a thing, object, or service.  No vocabulary or syntax is specified; service providers and clients are expected to encode sufficient information in the value so as to accurately and without ambiguity determine what the user has access to.  This value has no canonical types, although a type may be useful as a means to scope entitlements.',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:entitlement'
                  }
                },
                roles: {
                  type: 'array',
                  description: 'A list of roles for the user that collectively represent who the user is, e.g., `Student`, `Faculty`.',
                  items: {
                    $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json:$defs:role'
                  }
                }
              },
              required: ['userName']
            }]
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:email': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'Email addresses for the user.  The value SHOULD be canonicalized by the service provider, e.g., `bjensen@example.com` instead of `bjensen@EXAMPLE.COM`. Canonical type values of `work`, `home`, and `other`.',
                format: 'email'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function, e.g., `work` or `home`.',
                enum: ['work', 'home', 'other']
              },
              primary: {
                type: 'boolean',
                description: 'A Boolean value indicating the `primary` or preferred attribute value for this attribute, e.g., the preferred mailing address or primary email address.  The primary attribute value `true` MUST appear no more than once.',
                default: false
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:phoneNumber': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'Phone number of the User.'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function, e.g., `work`, `home`, `mobile`.',
                enum: ['work', 'home', 'mobile', 'fax', 'pager', 'other']
              },
              primary: {
                type: 'boolean',
                description: 'A Boolean value indicating the `primary` or preferred attribute value for this attribute, e.g., the preferred phone number or primary phone number.  The primary attribute value `true` MUST appear no more than once.',
                default: false
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:im': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'Instant messaging address for the User.'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function, e.g., `aim`, `gtalk`, `xmpp`.'
              },
              primary: {
                type: 'boolean',
                description: 'A Boolean value indicating the `primary` or preferred attribute value for this attribute, e.g., the preferred messenger or primary messenger.  The primary attribute value `true` MUST appear no more than once.',
                default: false
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:photo': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'URL of a photo of the User.',
                format: 'uri'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function, i.e., `photo` or `thumbnail`.',
                enum: ['photo', 'thumbnail']
              },
              primary: {
                type: 'boolean',
                description: 'A Boolean value indicating the `primary` or preferred attribute value for this attribute, e.g., the preferred photo or thumbnail.  The primary attribute value `true` MUST appear no more than once.',
                default: false
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:address': {
            type: 'object',
            properties: {
              formatted: {
                type: 'string',
                description: 'The full mailing address, formatted for display or use with a mailing label.  This attribute MAY contain newlines.'
              },
              streetAddress: {
                type: 'string',
                description: 'The full street address component, which may include house number, street name, P.O. box, and multi-line extended street address information.  This attribute MAY contain newlines.'
              },
              locality: {
                type: 'string',
                description: 'The city or locality component.'
              },
              region: {
                type: 'string',
                description: 'The state or region component.'
              },
              postalCode: {
                type: 'string',
                description: 'The zip code or postal code component.'
              },
              country: {
                type: 'string',
                description: 'The country name component.  When specified, the value MUST be in ISO 3166-1 `alpha-2` code format [ISO3166]; e.g., the United States and Sweden are `US` and `SE`, respectively.'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function, e.g., `work` or `home`.',
                enum: ['work', 'home', 'other']
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:group': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'The identifier of the User`s group.'
              },
              $ref: {
                type: 'string',
                description: 'The URI of the corresponding `Group` resource to which the user belongs.',
                format: 'uri'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function, e.g., `direct` or `indirect`.',
                enum: ['direct', 'indirect']
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:entitlement': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'The value of an entitlement.'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function.'
              },
              primary: {
                type: 'boolean',
                description: 'A Boolean value indicating the `primary` or preferred attribute value for this attribute.  The primary attribute value `true` MUST appear no more than once.'
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:role': {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'The value of a role.'
              },
              type: {
                type: 'string',
                description: 'A label indicating the attribute`s function.'
              },
              primary: {
                type: 'boolean',
                description: 'A Boolean value indicating the `primary` or preferred attribute value for this attribute.  The primary attribute value `true` MUST appear no more than once.'
              }
            },
            required: []
          },
          'schemata:SCIMv2:User.1.0.schema.json:$defs:name': {
            type: 'object',
            properties: {
              formatted: {
                type: 'string',
                description: 'The full name, including all middle names, titles, and suffixes as appropriate, formatted for display (e.g., `Ms. Barbara J Jensen, III`).'
              },
              familyName: {
                type: 'string',
                description: 'The family name of the User, or last name in most Western languages (e.g., `Jensen` given the full name `Ms. Barbara J Jensen, III`).'
              },
              givenName: {
                type: 'string',
                description: 'The given name of the User, or first name in most Western languages (e.g., `Barbara` given the full name `Ms. Barbara J Jensen, III`).'
              },
              middleName: {
                type: 'string',
                description: 'The middle name(s) of the User (e.g., `Jane` given the full name `Ms. Barbara J Jensen, III`).'
              },
              honorificPrefix: {
                type: 'string',
                description: 'The honorific prefix(es) of the User, or title in most Western languages (e.g., `Ms.` given the full name `Ms. Barbara J Jensen, III`).'
              },
              honorificSuffix: {
                type: 'string',
                description: 'The honorific suffix(es) of the User, or suffix in most Western languages (e.g., `III` given the full name `Ms. Barbara J Jensen, III`).'
              }
            },
            required: []
          },
          'schemata:SCIMv2:Resource.1.0.schema.json': {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'A unique identifier for a SCIM resource as defined by the service provider.'
              },
              externalId: {
                type: 'string',
                description: 'A String that is an identifier for the resource as defined by the provisioning client.'
              },
              meta: {
                $ref: '#/$defs/schemata:SCIMv2:Meta.1.0.schema.json'
              }
            },
            required: []
          },
          'schemata:SCIMv2:Meta.1.0.schema.json': {
            type: 'object',
            properties: {
              resourceType: {
                type: 'string',
                description: 'The name of the resource type of the resource.  This attribute has a mutability of `readOnly` and `caseExact` as `true`.',
                readonly: true
              },
              created: {
                type: 'string',
                description: 'The `DateTimeOffset` that the resource was added to the service provider.  This attribute MUST be a DateTimeOffset ISO8601Z.',
                format: 'date-time',
                readonly: true
              },
              lastModified: {
                type: 'string',
                description: 'The most recent DateTimeOffset that the details of this resource were updated at the service provider.  If this resource has never been modified since its initial creation, the value MUST be the same as the value of `created`.',
                format: 'date-time',
                readonly: true
              },
              location: {
                type: 'string',
                description: 'The URI of the resource being returned.  This value MUST be the same as the `Content-Location` HTTP response header (see Section 3.1.4.2 of [RFC7231]).',
                format: 'uri',
                readonly: true
              },
              version: {
                type: 'string',
                description: 'The version of the resource being returned.  This value must be the same as the entity-tag (ETag) HTTP response header (see Sections 2.1 and 2.3 of [RFC7232]).',
                readonly: true
              }
            },
            required: ['resourceType']
          }
        },
        $ref: '#/$defs/schemata:SCIMv2:User.1.0.schema.json'
      }

      assert.deepStrictEqual(result, expectedSchema)
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
