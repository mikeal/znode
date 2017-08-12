# znode

znode is a remote method execution library for Node.js and the browser.

* Bi-directional RPC over *any* stream (WebRTC, WebSockets, TCP, etc)
* Supports binary types natively without serializing to strings. [1]
* Simple API using async await.
* Supports RPC methods **returning additional RPC methods.**

[1] Underlying implementation uses msgpack5. Performance is optimized for binary type usage (JSON would be faster for cases other than binary types).

## Full Usage

```javascript
const RPC = {
  /* basic method support */
  ping: () => 'pong',
  /* async methods work identicaly to sync methods */
  ping2: async () => 'pong2',
  /* supports binary types */
  pingBuffer: () => Buffer.from('pong')
  /* you can also add static properties */
  API: 'v1'
}

net.createServer(async socket => {
  let remote = await znode(socket, RPC)

  let concater = await remote.createConcat('pre-')
  console.log(await concater.concat('post')) // priv-pre-post
})
.listen(async () => {

  const dynamicRPC = {
    createConcat: str => {
      let private = 'priv-'
      return {concat: _str => private + str + str}
    }
  }

  let socket = net.connect(port)
  let remote = await znode(socket, dynamicRPC)
  console.log(await remote.ping()) // pong
  console.log(await remote.ping2()) // pong2
  console.log(await remote.pingBuffer()) // <Buffer 70 6f 6e 67>
  console.log(remote.API) // v1
})
```

RPC methods can return anything that can be serialized by msgpack5.
RPC methods can also return objects with method additiona methods that will
be turned into additional remote methods.
