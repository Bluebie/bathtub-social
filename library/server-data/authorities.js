// Authorities is a singleton object which keeps track of which keys allow access to adaministrator
// and moderator functions
const fs = require('fs-extra')
const appRoot = require('app-root-path')
const nacl = require('tweetnacl')
const PQueue = require('p-queue').default

class Authorities {
  constructor(dataPath) {
    this.dataPath = dataPath || appRoot.resolve('/configuration/authorities.json')
    this.data = fs.readJSONSync(this.dataPath)
    this.writeQueue = new PQueue({ concurrency: 1 })
  }

  // returns an array of objects containing info about registered authority keys
  list() {
    return Object.entries(this.data).map(([key, value]) => ({ identity: key, ...value }))
  }

  // returns credentials for a request or public key
  get(requestOrPublicKeyString) {
    let publicKey = typeof(requestOrPublicKeyString) == 'string' ? requestOrPublicKeyString : requestOrPublicKeyString.sig.identity
    if (!publicKey) throw new Error("Authorities#credentialsFor: Public Key missing in input")

    return this.data[publicKey]
  }

  // set authority of a user
  set(publicKey, roleName, note = '') {
    this.data[publicKey] = { role: roleName, note, created: Date.now() }
    this.writeQueue.add(()=> fs.writeJSON(this.dataPath, this.data))
  }

  // remove an authority listing
  delete(publicKey) {
    delete this.data[publicKey]
    this.writeQueue.add(()=> fs.writeJSON(this.dataPath, this.data))
  }

  // verify a client provided badge for a request
  // badges are produced using ../crypto/badge.js
  // Rules:
  //  - badge messsage must have been generated within 1 minute of server side time
  //  - badge must sign the current user's ephemeral publicKey and the timestamp
  //  - badge must be signed with a registered badge secretKey
  // If all of that is true, and the data is valid, returns the badge's role
  verify(publicKey, badge) {
    if (!badge || !badge.signature || !badge.identity || !badge.key || !badge.timestamp) return undefined
    if (Math.abs(badge.timestamp - Date.now()) < 60_000) return undefined
    if (badge.identity != publicKey) return undefined
    let signature = Buffer.from(`${badge.signature}`, 'base64')
    let identity = Buffer.from(`${badge.identity}`, 'base64')
    let key = Buffer.from(`${badge.key}`, 'base64')
    if (!nacl.sign.detached.verify(Buffer.concat([identity, Buffer.from(badge.timestamp.toString())]), signature, key)) return undefined
    let auth = this.get(badge.key)
    if (!auth) return undefined
    return auth
  }

  // just like .verify but accepts a request as input, and does some caching
  verifyRequest(req, validRoles = null) {
    if (!req.badge) {
      if (!req.sig || !req.sig.identity || req.sig.valid !== true) return undefined
      if (!req.body || !req.body.badge) return undefined
      req.badge = this.verify(req.sig.identity, req.body.badge)
    }
    if (!validRoles || validRoles.includes(req.badge.role)) {
      return req.badge
    }
  }
}

let singleton = new Authorities

module.exports = singleton