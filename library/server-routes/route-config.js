const express = require('express')
const fs = require('fs-extra')
const appRoot = require('app-root-path')
const config = require('../../package.json').bathtub
const { signedMiddleware, requireSignature } = require('../crypto/parse-request')
const parseDuration = require('parse-duration')
const sizeOf = require('image-size')
const authorities = require('../server-data/authorities')
const bans = require('../server-data/bans')

app = express.Router({})

app.use(signedMiddleware)
app.use(bans.bannedMiddleware())

// returns info about what avatar decorations are available
app.get('/avatar-decorations', async (req, res) => {
  let data = {}

  // iterate over filenames and build avatar decorations info object
  for (let filename of await fs.readdir(appRoot.resolve('/style/avatar-decorations'))) {
    let baseName = filename.replace(/\.(png|jpeg|gif|webp|heif)$/, '')
    let [name, res] = baseName.split('@')
    if (!res) res = '1x'
    data[name] = data[name] || {}
    data[name]
    data[name][res] = filename
  }

  res.send(data)
})

// return list of users in the authorities database
app.post('/authorities/', requireSignature, (req, res) => {
  // only users with a valid badge in request can use this api
  if (!authorities.verifyRequest(req, ['admin'])) return res.sendStatus(403)

  res.send(authorities.list())
})

// add a publicKey to the authorities database
app.post('/authorities/:key/create', requireSignature, async (req, res)=> {
  // only users with a valid badge in request can use this api
  if (!authorities.verifyRequest(req, ['admin'])) return res.sendStatus(403)

  await authorities.set(req.params.key, req.body.role)
  res.send({ ok: true })
})

// delete a key from the authorities database
app.post('/authorities/:key/delete', requireSignature, async (req, res)=> {
  // only users with a valid badge in request can use this api
  if (!authorities.verifyRequest(req, ['admin'])) return res.sendStatus(403)

  await authorities.delete(req.params.key, req.body.role)
  res.send({ ok: true })
})

// verify if a badge is valid
app.post('/authorities/:key/verify', requireSignature, (req, res)=> {
  let response = authorities.verify(req.sig.identity, req.body.badge)
  if (response) {
    res.send({ valid: true, info: response })
  } else {
    res.send({ valid: false })
  }
})

// banning tools
app.post('/bans', requireSignature, (req, res) => {
  // only users with a valid badge in request can use this api
  if (!authorities.verifyRequest(req)) return res.sendStatus(403)

  res.send(bans.list())
})

app.post('/bans/create', requireSignature, (req, res) => {
  // only users with a valid badge in request can use this api
  if (!authorities.verifyRequest(req)) return res.sendStatus(403)

  bans.ban(req.body.targetIdentity, {
    reason: req.body.reason,
    duration: req.body.duration,
    authority: auth
  })
  res.send({ ok: true })
})

app.post('/bans/:uuid/delete', requireSignature, (req, res) => {
  // only users with a valid badge in request can use this api
  if (!authorities.verifyRequest(req)) return res.sendStatus(403)

  bans.unban(req.body.uuid)
  res.send({ ok: true })
})






module.exports = app