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
export async function load (uri, basepath, { lang, providers } = {}) {
  lang = lang ?? 'en-US'
  providers = providers ?? {
    http: async function schemaFromHttp (url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP_${res.status}`)
      const schema = await res.json()
      return schema
    }
  }
  // helpers
  function keyFrom ($ref) { return $ref.replaceAll('/', ':') }
  const $defs = {}
  async function visitor (node, path) {
    if (typeOf(node) === 'object' && '$ref' in node) {
      const $ref = node.$ref
      if ($ref.startsWith('#')) {
        // anchors references other schemas on the document itself
      } else {
        const key = keyFrom($ref)
        if (!(key in $defs)) {
          const schema = await loadSchema($ref, basepath, { lang, providers })
          $defs[key] = schema
          await traverse(schema, visitor)
        }
        node.$ref = `#/$defs/${key}`
      }
    }
  }
  // initialize by loading the root schema
  const key = keyFrom(uri)
  const root = await loadSchema(uri, basepath, { lang, providers })
  $defs[key] = root
  // recursively load requirements
  await traverse(root, visitor)
  // always return a referenced schema to handle recursive/circular case
  return { $defs, $ref: `#/$defs/${key}` }
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
export async function loadSchema (uri, basepath, { lang, providers } = {}) {
  const url = new URL(uri, basepath)
  const protocol = url.protocol.slice(0, -1)
  if (protocol in providers) {
    const schema = await providers[protocol](url.toString())
    const l10n = await providers[protocol](url.toString().replace('.schema.json', `.${lang}.json`)) ?? {}
    Object.entries(l10n).forEach(([path, value]) => {
      _set(schema, path, value)
    })
    return schema
  }
  throw new Error(`JSONSCHEMA_LOADER_PROTOCOL_${protocol.toUpperCase()}_NOT_IMPLEMENTED`)
}
