const msgpackStream = require('msgpack5-stream')

const znode = (_stream, rpc) => {
  let resolveRemote
  let onRemote = new Promise((resolve, reject) => {
    resolveRemote = resolve
  })
  let stream = msgpackStream(_stream)

  if (rpc) {
    rpc = Object.assign({}, rpc)
    stream.write({methods: Object.keys(rpc)})
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
    return rpc[key](...args)
  }
  const toRemote = async (key, ...args) => {
    let id = Math.random().toString()
    let promise = remotePromise(id)
    stream.write({method: key, args, id})
    return promise
  }
  stream.on('data', data => {
    if (data.methods) {
      // manifest
      let remotes = {}
      let mkmethod = key => {
        return async (...args) => toRemote(key, ...args)
      }
      data.methods.forEach(key => {
        remotes[key] = mkmethod(key)
      })

      resolveRemote(remotes)
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
      if (data.then) promise.resolve(...data.then)
      if (data.catch) promise.reject(new Error(data.catch))
      remotesMap.delete(data.resolve)
      return
    }
  })
  return onRemote
}

module.exports = znode
