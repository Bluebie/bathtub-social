const express = require('express')
const fs = require('fs-extra')
const appRoot = require('app-root-path')
const SSE = require('sse-writer')
const mediasoup = require('mediasoup')
const publicIP = require('public-ip')
const bytes = require('bytes')
const config = require('../../package.json').bathtub
const Room = require('../server-data/room')
const { signedMiddleware, requireSignature } = require('../crypto/parse-request')
const parseDuration = require('parse-duration')
const sizeOf = require('image-size')
const authorities = require('../server-data/authorities')
const bans = require('../server-data/bans')

const HTMLDocument = require('../views/html-document')
const TextRoomView = require('../views/view-text-room')
const RoomView = require('../views/view-room')

// load room configurations
let rooms = {}
fs.readdirSync(appRoot.resolve('configuration/rooms')).forEach(roomFilename => {
  let roomConfig = fs.readJSONSync(appRoot.resolve(`configuration/rooms/${roomFilename}`))
  let room = new Room(roomConfig)
  rooms[roomConfig.roomID] = room
})

// setup WebRTC router
let msWorker
let msRouters = {}
async function setupWebRTC() {
  msWorker = await mediasoup.createWorker({ logLevel: 'warn' })

  if (config.enableIPv6) {
    var [ip4, ip6] = await Promise.all([publicIP.v4(), publicIP.v6()])
  } else {
    var [ip4, ip6] = [await publicIP.v4(), null]
  }

  // create a router for each room
  for (let roomID of Object.keys(rooms)) {
    msRouters[roomID] = msWorker.createRouter({
      mediaCodecs: [
        //{ kind: 'video', mimeType: 'video/VP8', preferredPayloadType: 0, clockRate: 60 }
      ],
      appData: { roomID }
    })
  }
}

setupWebRTC()

app = express.Router({})

app.use(signedMiddleware)
app.use(bans.bannedMiddleware())

// middleware to add room object and person object to room requests
app.param('roomID', (req, res, next, roomID)=> {
  let room = rooms[roomID]
  if (!room) {
    res.sendStatus(404)
  } else {
    req.room = room
    // if the request is signed, try to find the user in this room too
    if (req.sig && req.sig.valid) {
      req.person = room.getPerson(req.sig.identity)
    }
    next()
  }
})

// get public info about rooms or a specific room
app.get('/', (req, res) => res.send(Object.values(rooms).map(room => room.getPublicInfo())) )
app.get('/:roomID/', (req, res) => res.send(req.room.getPublicInfo()) )

// render user interface
app.get('/:roomID/text-interface', (req, res) => {
  let doc = new HTMLDocument(new TextRoomView({ roomStateData: req.room.getStateData() }))
  res.send(`${doc.toHTML()}`)
})

app.get('/:roomID/interface', (req, res) => {
  let doc = new HTMLDocument(new RoomView({ roomStateData: req.room.getStateData() }))
  res.send(`${doc.toHTML()}`)
})

// room EventSource stream, causes a join announce too
let userTimeouts = new WeakMap()
app.get('/:roomID/event-stream', requireSignature, (req, res) => {
  let room = req.room

  // initialise event stream
  let sse = new SSE()
  // tell client how quickly they should reconnect
  sse.retry(config.reconnectInterval)
  res.set('Content-Type', 'text/event-stream')
  // pipe event stream out to client
  sse.pipe(res)

  // define a function which forwards SubscriptionLog entries to the SSE stream
  let append = info => {
    // only share broadcast messages and messages addressed to this user
    if (!info.to || info.to == req.sig.identity) {
      sse.event({ id: info.uuid, data: JSON.stringify(info) })
    }
  }

  // fail if room doesn't exist
  if (!req.query.attributes) return append({ uuid: 0, error: "attributes property required in query string" })
  
  // subscribe to room log and continue streaming out log updates
  room.log.on('append', append)

  // if user isn't in the room already, join the room
  if (!req.person) {
    try {
      room.personJoin(req.sig.identity, { attributes: req.query.attributes })
    } catch (err) {
      console.error(err)
      return res.statusStatus(429)
    }
  }

  // get person object
  let person = room.getPerson(req.sig.identity)

  // when user disconnects, clean up events
  req.on('aborted', () => {
    console.info("Aborted", req.sig.identity)
    room.log.off('append', append)
    // if the user is still in the presence list, remove them after a timeout
    userTimeouts.set(person, setTimeout(() => {
      try {
        if (room.getPerson(req.sig.identity)) {
          room.personLeave(req.sig.identity)
        }
      } catch(err) { console.warn(err) }
    }, parseDuration(config.disconnectTimeout)))
  })
  
  // clear any existing timeout, if they were already connected and had to reconnect
  clearTimeout(userTimeouts.get(person))

  // if user is reconnecting, and we still have the old log data, catch them up
  // otherwise send them a room state object and treat it like a reconnection
  let lastEventID = req.get('Last-Event-ID')
  if (lastEventID && room.log.has(lastEventID)) {
    // if the client is reconnecting, and we have history to that point, replay what they missed
    room.log.since(lastEventID).forEach(append)
  } else {
    // client is new or too far out of sync to recover, give them a full state
    sse.event({
      data: JSON.stringify({
        messageType: 'roomState',
        data: room.getStateData(),
      })
    })
  }
})

// user can request to leave the room
app.post('/:roomID/leave', requireSignature, (req, res) => {
  if (req.body.leave !== true) return res.status(500).send({ error: "Request body must include { leave: true } property" })
  try { req.room.personLeave(req.sig.identity) }
  catch (err) { return res.status(500).send({ error: err.message }) }
  res.send({ ok: true })
})

// user can request to update their attributes
app.post('/:roomID/set-attributes', requireSignature, (req, res) => {
  if (!req.person) return res.status(500).send({ error: "User is not in room, cannot update" })

  if (typeof(req.body.patch) !== 'object' || Array.isArray(req.body.patch)) return res.status(500).send({ error: "patch property in body must be json {object}" })
  try {
    req.room.personChange(req.sig.identity, { attributes: req.body.patch })
  } catch(err) {
    return res.status(500).send({ error: err.message })
  }
  return res.send({ ok: true })
})

// when a user sends a message to the room, publish that
app.post('/:roomID/send', requireSignature, (req, res) => {
  if (!req.person) return res.status(500).send({ error: "User is not in room, cannot send message" })
  req.room.send(req.person.identity, req.body)
  res.send({ ok: true })
})

// upload an avatar to user's object as a data uri, streamed out over event streams
app.post('/:roomID/avatar', requireSignature, (req, res)=> {
  if (!req.person) return res.status(500).send({ error: "You are not in this room, you can't publish an avatar yet" })
  if (req.get('Content-Type') != config.avatarMimeType) return res.status(500).send({ error: "Post body must be a JPEG" })

  if (!Buffer.isBuffer(req.body)) return res.status(500).send({ error: "Image data didn't arrive as a buffer??" })
  if (req.body.byteLength > bytes.parse(config.avatarMaxData)) return res.status(500).send({ error: "Image data is too large in bytes" })
  if (req.body.byteLength < 8) return res.status(500).send({ error: "Image data is too small in bytes" })
  
  let size = sizeOf(req.body)
  if (size.width != config.avatarSize) return res.status(500).send({ error: "Avatar width is incorrect" })
  if (size.height != config.avatarSize) return res.status(500).send({ error: "Avatar height is incorrect" })
  if (`image/${size.type.replace('jpg', 'jpeg')}` != config.avatarMimeType) return res.status(500).send({ error: "File data does not look like JPEG" })

  // it all validates, so we can let the client know it's accepted now
  res.send({ ok: true })

  // encode JPEG to a data uri
  let datauri = `data:${req.get('Content-Type')};base64,${req.body.toString('base64')}`

  // generate a patch to update any changed fields with new avatar data
  req.room.personChange(req.person.identity, person => {
    person.avatar = {
      width: size.width,
      height: size.height,
      type: req.get('Content-Type'),
      src: datauri,
      timestamp: Date.now()
    }
  })
})

// ask server to authenticate a badge and wear it on avatar
// this causes a personChange event if necessary, broadcasting the user's badge to everyone
app.post('/rooms/:roomID/badge', requireSignature, (req,res)=> {
  if (!req.person) return res.status(500).send({ error: "You aren't in this room, cannot update badge" })

  // get the role for this badge
  let auth = authorities.verify(req.person.identity, req.body.badge)
  if (req.person.authority != auth.role) {
    req.room.personChange(req.person.identity, { authority: auth.role })
  }

  res.send({ ok: true, authority: auth.role })
})

module.exports = app