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
  let rpc = {ping: () => 'pong'}
  let server = createServer(rpc)
  await listen(server)(1234)
  let remote = await createClient(1234, {pong: () => 'ping'})
  t.same(await remote.ping(), 'pong')
  clear(server)
})

test('get and return buffer', async t => {
  t.plan(1)
  let rpc = {ping: () => Buffer.from('test')}
  let server = createServer(rpc)
  await listen(server)(1234)
  let remote = await createClient(1234, {pong: () => 'ping'})
  t.same(await remote.ping(), Buffer.from('test'))
  clear(server)
})

test('throw in RPC method', async t => {
  t.plan(2)
  let rpc = { ping: () => { throw new Error('test') } }
  let server = createServer(rpc)
  await listen(server)(1234)
  let remote = await createClient(1234)
  try {
    await remote.ping()
  } catch (e) {
    t.type(e, 'Error')
    t.type(e.message, 'test')
  }
  clear(server)
})
