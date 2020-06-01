// crypto functions for generating and verifying badges (used for admin auth)
const nacl = require('tweetnacl')

class Badge {
  constructor(keyData) {
    this.keyPair = nacl.sign.fromSecretKey(nacl.hash(keyData))
    this.key = Buffer.from(this.keyPair.publicKey).toString('base64')
  }

  // generates a new badge, valid for 1 minute normally, which can be included in requests requiring authority
  issue(identity) {
    let now = Math.round(Date.now())
    let rawIdentity = Buffer.from(identity, 'base64')
    let signedData = Buffer.concat([rawIdentity, Buffer.from(now.toString())])
    return {
      key: this.key,
      signature: Buffer.from(nacl.sign.detached(signedData, this.keyPair.secretKey)).toString('base64'),
      identity,
      timestamp: Date.now(),
    }
  }
}

module.exports = Badge