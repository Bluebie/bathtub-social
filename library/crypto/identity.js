// Identity provides a signed requests from client to server, to know who is making requests
// without using cookies.
const nacl = require('tweetnacl')
const uri = require('encodeuricomponent-tag')

class Identity {
  constructor(privateKey) {
    if (typeof(privateKey) == 'string') {
      let privateKeyBuffer = Buffer.from(privateKey, 'base64')
      if (privateKeyBuffer.byteLength != nacl.sign.secretKeyLength) throw new Error('Private Key length is incorrect')
    } else {
      this.keyPair = nacl.sign.keyPair()
    }
    this.base64 = {
      publicKey: Buffer.from(this.keyPair.publicKey).toString('base64')
    }
  }



  // returns a public identity object, for joining stuff
  toPublicIdentity() {
    return this.base64.publicKey
  }

  // returns a boolean, if this identity is our own
  equals(identity) {
    return Buffer.isBuffer(identity) ? identity.equals(this.keyPair.publicKey) : identity == this.base64.publicKey 
  }

  // accepts a string, signs it, returns an object with two custom headers to add to request
  signRequest(pathname, message) {
    let signedContent = [Buffer.from(pathname), Buffer.from(message)]
    let signature = nacl.sign.detached(Buffer.concat(signedContent), this.keyPair.secretKey)
    return {
      "X-Bathtub-Identity": this.base64.publicKey,
      "X-Bathtub-Signature": Buffer.from(signature).toString('base64')
    }
  }

  // add a query string for situations where headers can't be added (like EventSource)
  signedQueryString(pathname, properties) {
    let data = JSON.stringify(properties)
    let outputProps = { data, ...this.signRequest(pathname, data) }
    let queryString = Object.entries(outputProps).map(([key, value]) => uri`${key}=${value}`)
    return `${pathname}?${queryString.join('&')}`
  }

  // fetch request which is signed using this identity
  signedFetch(path, options = {}) {
    let url = new URL(path, "http://placeholder/")
    let signatureHeaders = this.signRequest(url.pathname, options.body || "")
    return fetch(url.pathname, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...signatureHeaders
      }
    })
  }

  get(path, options = {}) {
    return this.signedFetch(path, {
      method: 'GET',
      ...options
    })
  }

  async getJSON(path, options = {}) {
    let response = await this.get(path, options)
    return response.json()
  }

  post(path, options = {}) {
    return this.signedFetch(path, {
      method: 'POST',
      ...options
    })
  }

  async postJSON(path, object, options = {}) {
    let response = await this.post(path, { body: JSON.stringify(object), headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
    return response.json()
  }
}

// create an identity with a consistent secret key from a hash of arbitrary length data
Identity.fromHashedData = async function(buffer) {
  if (buffer.arrayBuffer) buffer = await buffer.arrayBuffer() // if it looks like a Blob, convert to arrayBuffer
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer) // if it isn't a node-style buffer, convert it to one
  if (buffer.byteLength < 64) console.warn("Identity's input is very small, resulting private key may not be secure")
  return new Identity(nacl.hash(buffer)) // build a new identity, using a hash of the file's contents as the secret key
}

module.exports = Identity