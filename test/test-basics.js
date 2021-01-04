/* globals describe, it */
const znode = require('../')
const net = require('net')
const stream = require('stream')
const promisify = require('util').promisify
const same = require('assert').deepStrictEqual

const test = it

const sockets = []

const createServer = rpc => {
  const server = net.createServer(socket => {
    znode(socket, rpc)
  })
  return server
}
const createClient = async (port, rpc) => {
  const socket = net.connect(port)
  sockets.push(socket)
  return znode(socket, rpc)
}
const listen = (server) => {
  return promisify((port, cb) => server.listen(port, cb))
}
const clear = (server) => {
  while (sockets.length) {
    sockets.shift().destroy()
  }
  server.close()
}

describe('basics', () => {
  test('get and return string', async () => {
    const rpc = { ping: () => 'pong' }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234, { pong: () => 'ping' })
    same(await remote.ping(), 'pong')
    clear(server)
  })

  test('get and return buffer', async () => {
    const rpc = { ping: () => Buffer.from('test') }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234, { pong: () => 'ping' })
    same(await remote.ping(), Buffer.from('test'))
    clear(server)
  })

  test('rpc with static values', async () => {
    const rpc = { ping: () => Buffer.from('test'), id: 'test' }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234, { pong: () => 'ping' })
    same(await remote.ping(), Buffer.from('test'))
    same(remote.id, 'test')
    clear(server)
  })

  test('rpc with async method', async () => {
    const rpc = { ping: async () => Buffer.from('test') }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234, { pong: () => 'ping' })
    same(await remote.ping(), Buffer.from('test'))
    clear(server)
  })

  test('throw in RPC method', async () => {
    const rpc = { ping: () => { throw new Error('test') } }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234)
    let threw = true
    try {
      await remote.ping()
      threw = false
    } catch (e) {
      if (e.message !== 'test') throw e
    }
    same(threw, true)
    clear(server)
  })

  test('invalid RPC type', async () => {
    let threw = true
    const s = new stream.Duplex()
    try {
      znode(s, Buffer.from('asdf'))
      threw = false
    } catch (e) {
      if (e.message !== 'Cannot pass instances as RPC interfaces.') throw e
    }
    same(threw, true)
  })

  test('arguments', async () => {
    const rpc = {
      testargs: (one, two, three) => [one, two, three]
    }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234)
    same(await remote.testargs(1, 2, 3), [1, 2, 3])
    clear(server)
  })

  test('function without return', async () => {
    const rpc = {
      test1: () => { },
      test2: async () => { }
    }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234)
    same(await remote.test1(), undefined)
    same(await remote.test2(), undefined)
    clear(server)
  })
})
