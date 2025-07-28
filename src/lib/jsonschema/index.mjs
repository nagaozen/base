import { _set } from '../object/index.mjs'
import { traverse } from '../json/index.mjs'
import { typeOf } from '../typeOf.mjs'

/**
 * Loads a JSON schema from a URI, resolves all $ref references recursively,
 * and returns the schema with all external references replaced with local ones under $defs.
 *
 * @async
 * @function load
 * @param {string} uri - The URI of the root JSON schema to load.
 * @param {string} basepath - The base path to resolve relative URIs.
 * @param {object} [options] - Optional parameters.
 * @param {string} [options.lang='en-US'] - Language code for localization.
 * @param {object} [options.providers] - Object mapping protocols to functions that load schemas.
 * @returns {Promise<object>} A Promise that resolves to the loaded and resolved JSON schema.
 * @throws {Error} If loading or resolving schemas fails.
 */
export async function load (uri, basepath, { lang, providers, ...otherOptions } = {}) {
  lang = lang ?? 'en-US'
  providers = providers ?? {
    http: async function schemaFromHttp (url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP_${res.status}`)
      const schema = await res.json()
      return schema
    }
  }
  // initialize by loading the root schema
  const $defs = {}
  const key = keyFrom(uri)
  const root = await loadSchema(uri, basepath, { lang, providers, ...otherOptions })
  $defs[key] = root
  // recursively load requirements
  await traverse(root, visitor)
  // always return a referenced schema to handle recursive/circular case
  return { $defs, $ref: `#/$defs/${key}` }
  // helpers
  function keyFrom ($ref) { return $ref.replaceAll('/', ':') }
  async function visitor (node, path) {
    // short-circuit
    if (typeOf(node) !== 'object') return
    if (!('$ref' in node || '$defs' in node)) return
    if ('$ref' in node) {
      const $ref = node.$ref
      /* IMPORTANT:
        When talking about [JSONSchema](https://json-schema.org/understanding-json-schema/structuring#dollarref), a schema can
        reference another schema using the `$ref` keyword. The value of `$ref` is a URI-reference that is resolved against the
        schema's Base URI.
        Yet, sometimes we wan't to also define a `$ref` property for our JSON object to keep complaint with another protocol,
        e.g. [SCIMv2 Core Schema](https://datatracker.ietf.org/doc/html/rfc7643#section-2.4) where `$ref` is among the default
        set of sub-attributes for a multi-valued attribute.
      */
      if (typeOf($ref) !== 'string') return// not a schema reference to another schema.
      if ($ref.startsWith('#')) {
        // anchors references on the document itself
        const key = `${keyFrom(uri)}:${keyFrom($ref.substring(2))}`
        node.$ref = `#/$defs/${key}`
        return
      }
      // visit
      const key = keyFrom($ref)
      if (!(key in $defs)) {
        const schema = await loadSchema($ref, basepath, { lang, providers, ...otherOptions })
        $defs[key] = schema
        await traverse(schema, visitor)
      }
      node.$ref = `#/$defs/${key}`
    }
    if ('$defs' in node) {
      const localDefs = Object.keys(node.$defs)
      localDefs.forEach(def => {
        const key = `${keyFrom(uri)}:$defs:${def}`
        $defs[key] = node.$defs[def]
      })
      delete node.$defs
    }
  }
}

/**
 * Helper function to load a schema from a URI.
 * Loads the schema and applies localization if available.
 *
 * @async
 * @function loadSchema
 * @param {string} uri - The URI of the schema to load.
 * @param {string} basepath - The base path to resolve relative URIs.
 * @param {object} options - Options object.
 * @param {string} options.lang - Language code for localization.
 * @param {object} options.providers - Object mapping protocols to functions that load schemas.
 * @returns {Promise<object>} A Promise that resolves to the loaded schema.
 * @throws {Error} If the protocol is not implemented or loading fails.
 */
export async function loadSchema (uri, basepath, { lang, providers, ...otherOptions }) {
  const url = new URL(uri, basepath)
  const protocol = url.protocol.slice(0, -1)
  if (protocol in providers) {
    const schema = await providers[protocol](url.toString(), otherOptions)
    let l10n = {}
    try {
      l10n = await providers[protocol](url.toString().replace('.schema.json', `.${lang}.json`), otherOptions)
    } catch (e) {
      // localization doesn't exist, so silently skip.
    }
    if (Array.isArray(l10n)) {
      l10n.forEach(({ path, value }) => {
        _set(schema, path, value)
      })
    } else {
      Object.entries(l10n).forEach(([path, value]) => {
        _set(schema, path, value)
      })
    }
    return schema
  }
  throw new Error(`JSONSCHEMA_LOADER_PROTOCOL_${protocol.toUpperCase()}_NOT_IMPLEMENTED`)
}
