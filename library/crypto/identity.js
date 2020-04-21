// Identity provides a signed requests from client to server, to know who is making requests
// without using cookies.
const nacl = require('tweetnacl')
const uri = require('encodeuricomponent-tag')

class Identity {
  constructor() {
    this.keyPair = nacl.sign.keyPair()
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
}

module.exports = Identity