const contentType = require('content-type')
const bodyParser = require('body-parser')
const URL = require('url').URL
const nacl = require('tweetnacl/nacl-fast')

// Express-style middleware to verify requests if they have included X-Bathtub-Identity
// and X-Bathtub-Signature headers; adds req.sig object containing publicKey and valid properties
// JSON bodies will be parsed, otherwise body is left as a raw buffer like bodyParser.raw()
module.exports.signedMiddleware = [
  bodyParser.raw(),
  (req, res, next)=> {
    let pathname = Buffer.from((new URL(req.originalUrl, "http://example.com/")).pathname)
    let identity = req.get('X-Bathtub-Identity') || req.query['X-Bathtub-Identity']
    let signature = req.get('X-Bathtub-Signature') || req.query['X-Bathtub-Signature']

    // if request is signed, validate it
    if (identity) {
      // base64 decode the signature data in to buffers
      let buf = {
        identity: Buffer.from(identity, 'base64'),
        signature: Buffer.from(signature, 'base64')
      }

      // concat the content that needs to be signed
      let signedContent = Buffer.concat([pathname, Buffer.from(req.query.data || req.body, 'utf-8')])
      // validate the signature using ed25519 via tweetnacl-js
      let valid = nacl.sign.detached.verify(signedContent, buf.signature, buf.identity)
      req.sig = { valid, identity }
    } else {
      req.sig = { valid: false }
    }

    // if body type is JSON, parse it, likewise with query string data format
    if (req.get('Content-Type') && contentType.parse(req.get('Content-Type')).type == "application/json") {
      req.body = JSON.parse(req.body.toString('utf-8'))
    } else if (identity && signature && req.query.data) {
      req.query = JSON.parse(req.query.data)
    }

    next()
  }
]

// Express-style middleware to require requests have a valid signature
module.exports.requireSignature = function(req, res, next) {
  if (!req.sig) throw new Error("Identity.verifySignatures middleware not run before requireSignature")
  if (req.sig.valid) {
    next()
  } else {
    res.status(401).send({ error: "Bathtub identity signature headers/query parameters are invalid or missing" })
  }
}