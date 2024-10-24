import { describe, it } from 'node:test'
import assert from 'node:assert'

import { PluginManager } from './index.mjs'

const IDENTIFIER = '[Plugin Manager]'

class AbstractPlugin {
  constructor (name) {
    if (this.constructor === AbstractPlugin) {
      throw new Error(`${IDENTIFIER} Abstract classes cannot be instantiated`)
    }
    this.name = name
  }

  beforeAction (context) {
    throw new Error(
      `${IDENTIFIER} Method \`beforeAction()\` must be implemented`
    )
  }

  afterAction (context) {
    throw new Error(
      `${IDENTIFIER} Method \`afterAction()\` must be implemented`
    )
  }
}

// Define Sync Plugin that inherits from AbstractPlugin
class SyncLoggerPlugin extends AbstractPlugin {
  constructor () {
    super('SyncLoggerPlugin')
  }

  beforeAction (...args) {
    const [context] = args
    context.state.push('@sync.beforeAction')
  }

  afterAction (...args) {
    const [context] = args
    context.state.push('@sync.afterAction')
  }
}

// Define Async Plugin that inherits from AbstractPlugin
class AsyncLoggerPlugin extends AbstractPlugin {
  constructor () {
    super('AsyncLoggerPlugin')
  }

  async beforeAction (...args) {
    const [context] = args
    context.state.push('@async.beforeAction starting')
    await new Promise(resolve => setTimeout(resolve, 5000))
    context.state.push('@async.beforeAction finish')
  }

  async afterAction (...args) {
    const [context] = args
    context.state.push('@async.afterAction starting')
    await new Promise(resolve => setTimeout(resolve, 5000))
    context.state.push('@async.afterAction finish')
  }
}

describe('# pluginManager', () => {
  it('should work', async () => {
    const result = [
      '@sync.beforeAction', '@async.beforeAction starting', '@async.beforeAction finish',
      '############################## main action ##############################', '@sync.afterAction',
      '@async.afterAction starting', '@async.afterAction finish'
    ]

    const context = {
      plugins: new PluginManager({ AbstractPlugin }),
      preventDefault: false,
      state: []
    }
    context.plugins.register(new SyncLoggerPlugin())
    context.plugins.register(new AsyncLoggerPlugin())

    await procedure(context)

    assert.deepStrictEqual(context.state, result)
  })
})

async function procedure (context) {
  const { plugins } = context
  await plugins.execute('beforeAction', context)
  if (!context.preventDefault) {
    context.state.push(
      '############################## main action ##############################'
    )
  }
  await plugins.execute('afterAction', context)
}
