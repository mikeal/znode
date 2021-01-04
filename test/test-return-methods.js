/* globals describe, it */
import znode from '../index.js'
import net from 'net'
import { promisify } from 'util'
import { deepStrictEqual as same } from 'assert'

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

describe('return methods', () => {
  test('get and return string', async () => {
    const rpc = {
      get: () => {
        return { ping: () => 'pong' }
      }
    }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234, { pong: () => 'ping' })
    const remote2 = await remote.get()
    same(await remote2.ping(), 'pong')
    clear(server)
  })

  test('get and return null', async () => {
    const rpc = {
      get: () => {
        return { ping: () => null }
      },
      n: n => null
    }
    const server = createServer(rpc)
    await listen(server)(1234)
    const remote = await createClient(1234, { pong: () => 'ping' })
    same(await remote.n(), null)
    const remote2 = await remote.get()
    same(await remote2.ping(), null)
    clear(server)
  })
})
