const msgpackStream = require('msgpack5-stream')

const znode = (_stream, rpc) => {
  if (rpc && rpc.constructor !== Object) {
    throw new Error('Cannot pass instances as RPC interfaces.')
  }
  let resolveRemote
  const onRemote = new Promise((resolve, reject) => {
    resolveRemote = resolve
  })
  const stream = msgpackStream(_stream)

  const registry = new Map()

  const prepareRPC = rpc => {
    const methods = {}
    const props = {}
    for (const key in rpc) {
      if (typeof rpc[key] === 'function') {
        const id = Math.random().toString()
        methods[key] = id
        registry.set(id, rpc[key])
      } else {
        props[key] = rpc[key]
      }
    }
    return { methods, props }
  }

  if (rpc) stream.write(prepareRPC(rpc))

  const remotesMap = new Map()
  const remotePromise = id => {
    let _resolve
    let _reject
    const promise = new Promise((resolve, reject) => {
      _resolve = resolve
      _reject = reject
    })
    promise.resolve = (...args) => _resolve(...args)
    promise.reject = (...args) => _reject(...args)
    remotesMap.set(id, promise)
    return promise
  }
  const fromRemote = async (key, args) => {
    let ret = registry.get(key)(...args)
    if (ret && ret.then) ret = await ret
    if (ret && ret.constructor === Object) {
      ret = prepareRPC(ret)
    }
    return ret
  }
  const toRemote = async (key, ...args) => {
    const id = Math.random().toString()
    const promise = remotePromise(id)
    stream.write({ method: key, args, id })
    return promise
  }

  const parseRPC = data => {
    const remotes = {}
    const mkmethod = key => {
      return async (...args) => toRemote(key, ...args)
    }
    for (const key in data.methods) {
      remotes[key] = mkmethod(data.methods[key])
    }
    for (const key in data.props) {
      remotes[key] = data.props[key]
    }
    return remotes
  }

  stream.on('data', data => {
    if (data.methods) {
      resolveRemote(parseRPC(data))
      return
    }
    if (data.method) {
      const clean = () => {} // clean.
      const promise = fromRemote(data.method, data.args)
      promise
        .then((...args) => {
          if (args.length === 1 && typeof args[0] === 'undefined') {
            args = []
          }
          stream.write({ resolve: data.id, then: args })
          clean()
        })
        .catch((e) => {
          stream.write({ resolve: data.id, catch: e.message, stack: e.stack })
          clean()
        })
      return
    }
    /* istanbul ignore else */
    if (data.resolve) {
      const promise = remotesMap.get(data.resolve)
      if (data.then) {
        const args = data.then.map(ret => {
          if (typeof ret === 'object' && ret !== null && ret.methods) {
            return parseRPC(ret)
          }
          return ret
        })
        promise.resolve(...args)
      }
      if (data.catch) {
        const e = new Error(data.catch)
        e.stack = data.stack
        promise.reject(e)
      }
      remotesMap.delete(data.resolve)
    }
  })
  return onRemote
}

module.exports = znode
