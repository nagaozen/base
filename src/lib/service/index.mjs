'use strict'

const IDENTIFIER = '[open-for-extension]'

export class PluginManager {
  constructor (dependencies) {
    Object.entries(dependencies).forEach(([key, value]) => {
      this[key] = value
    })
    this.plugins = {}
  }

  async autoload () {
    if (this?.services?.discovery) {
      const plugins = (await this.services.discovery.fetch()) ?? []
      plugins.forEach(plugin => {
        this.plugins[plugin.name] = plugin
      })
    }
  }

  register (plugin) {
    const isValid = plugin instanceof this.AbstractPlugin
    if (!isValid) {
      throw new Error(`${IDENTIFIER} \`${plugin.name}\` is NOT a valid plugin`)
    }
    this.plugins[plugin.name] = plugin
  }

  unregister (plugin) {
    delete this.plugins[plugin.name]
  }

  async execute (extensionPoint, ...args) {
    const plugins = Object.values(this.plugins)
    const promises = plugins.map(plugin =>
      Promise.resolve(plugin[extensionPoint](...args))
    )
    await Promise.all(promises)
  }
}
