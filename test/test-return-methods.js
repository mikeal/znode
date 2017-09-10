const znode = require('../')
const net = require('net')
const promisify = require('util').promisify
const test = require('tap').test

const sockets = []

const createServer = rpc => {
  let server = net.createServer(socket => {
    znode(socket, rpc)
  })
  return server
}
const createClient = async (port, rpc) => {
  let socket = net.connect(port)
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

test('get and return string', async t => {
  t.plan(1)
  let rpc = {get: () => {
    return { ping: () => 'pong' }
  }}
  let server = createServer(rpc)
  await listen(server)(1234)
  let remote = await createClient(1234, {pong: () => 'ping'})
  let remote2 = await remote.get()
  t.same(await remote2.ping(), 'pong')
  clear(server)
})

test('get and return null', async t => {
  t.plan(2)
  let rpc = {
    get: () => {
      return { ping: () => null }
    },
    n: n => null
  }
  let server = createServer(rpc)
  await listen(server)(1234)
  let remote = await createClient(1234, {pong: () => 'ping'})
  t.same(await remote.n(), null)
  let remote2 = await remote.get()
  t.same(await remote2.ping(), null)
  clear(server)
})
