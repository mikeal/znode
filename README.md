# znode

[![Build Status](https://travis-ci.org/mikeal/znode.svg?branch=master)](https://travis-ci.org/mikeal/znode)
[![dependencies Status](https://david-dm.org/mikeal/znode/status.svg)](https://david-dm.org/mikeal/znode)

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

<p>
  <a href="https://www.patreon.com/bePatron?u=880479">
    <img src="https://c5.patreon.com/external/logo/become_a_patron_button.png" height="40px" />
  </a>
</p>

znode is a remote method execution library for Node.js and the browser.

* Bi-directional RPC over *any* stream (WebRTC, [WebSockets](https://github.com/maxogden/websocket-stream), TCP, etc)
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
  pingBuffer: () => Buffer.from('pong'),
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
      let _private = 'priv-'
      return {concat: _str => _private + str + _str}
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
RPC methods can also return objects with additional methods that will
be turned into additional remote methods.
