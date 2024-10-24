import { _get } from './object/index.mjs'

/**
 * A minimalistic template function that replaces placeholders in a template string with values from a data source.
 *
 * This function searches for placeholders in the form of `{{placeholder}}` in the given template string
 * and replaces them with corresponding values from the provided data source object. If a placeholder does not have
 * a corresponding value in the data source, it is left unchanged.
 *
 * Inspired by the Mustache templating language: https://mustache.github.io/
 *
 * @param {string} template - The template string containing placeholders in the form of `{{placeholder}}`.
 * @param {Object} datasource - An object containing key-value pairs where keys correspond to placeholders in the template.
 * @returns {string} The resulting string after replacing the placeholders with corresponding values from the data source.
 */
export function micromustache (template, datasource) {
  const tag = /\{\{([^}]+)\}\}/gim
  return template.replace(tag, function (match, path) {
    const value = _get(datasource, path.trim())
    return value ?? `{{${path}}}`
  })
}
