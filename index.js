const msgpackStream = require('msgpack5-stream')

const znode = (_stream, rpc) => {
  let resolveRemote
  let onRemote = new Promise((resolve, reject) => {
    resolveRemote = resolve
  })
  let stream = msgpackStream(_stream)

  const registry = new Map()

  const prepareRPC = rpc => {
    let methods = {}
    let props = {}
    for (let key in rpc) {
      if (typeof rpc[key] === 'function') {
        let id = Math.random().toString()
        methods[key] = id
        registry.set(id, rpc[key])
      } else {
        props[key] = rpc[key]
      }
    }
    return {methods, props}
  }

  if (rpc) {
    if (rpc.constructor !== Object) {
      throw new Error('Cannot pass instances as RPC interfaces.')
    }
    stream.write(prepareRPC(rpc))
  }
  const remotesMap = new Map()
  const remotePromise = id => {
    let _resolve
    let _reject
    let promise = new Promise((resolve, reject) => {
      _resolve = resolve
      _reject = reject
    })
    promise.resolve = (...args) => _resolve(...args)
    promise.reject = (...args) => _reject(...args)
    remotesMap.set(id, promise)
    return promise
  }
  const fromRemote = async (key, ...args) => {
    let ret = registry.get(key)(...args)
    if (ret.then) ret = await ret
    if (ret.constructor === Object) {
      ret = prepareRPC(ret)
    }
    return ret
  }
  const toRemote = async (key, ...args) => {
    let id = Math.random().toString()
    let promise = remotePromise(id)
    stream.write({method: key, args, id})
    return promise
  }

  const parseRPC = data => {
    let remotes = {}
    let mkmethod = key => {
      return async (...args) => toRemote(key, ...args)
    }
    for (let key in data.methods) {
      remotes[key] = mkmethod(data.methods[key])
    }
    for (let key in data.props) {
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
      let clean = () => {} // clean.
      let promise = fromRemote(data.method, data.args)
      promise
      .then((...args) => {
        stream.write({resolve: data.id, then: args})
        clean()
      })
      .catch((e) => {
        stream.write({resolve: data.id, catch: e.message})
        clean()
      })
      return
    }
    /* istanbul ignore else */
    if (data.resolve) {
      let promise = remotesMap.get(data.resolve)
      if (data.then) {
        let args = data.then.map(ret => {
          if (typeof ret === 'object' && ret.methods) {
            return parseRPC(ret)
          }
          return ret
        })
        promise.resolve(...args)
      }
      if (data.catch) promise.reject(new Error(data.catch))
      remotesMap.delete(data.resolve)
    }
  })
  return onRemote
}

module.exports = znode
