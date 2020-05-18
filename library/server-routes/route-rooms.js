const express = require('express')
const fs = require('fs-extra')
const appRoot = require('app-root-path')
const SSE = require('sse-writer')
const config = require('../../package.json').bathtub
const Room = require('../server-data/room')
const { signedMiddleware, requireSignature } = require('../crypto/parse-request')
const parseDuration = require('parse-duration')
const sizeOf = require('image-size')

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

app = express.Router({})

app.use(signedMiddleware)

// get public info about rooms or a specific room
app.get('/', (req, res) => res.send(Object.values(rooms).map(room => room.getPublicInfo())) )
app.get('/:roomID/', (req, res) => res.send(rooms[req.params.roomID].getPublicInfo()) )

// render user interface
app.get('/:roomID/text-interface', (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room) return res.sendStatus(404)

  let doc = new HTMLDocument(new TextRoomView({ roomStateData: room.getStateData() }))
  res.send(`${doc.toHTML()}`)
})

app.get('/:roomID/interface', (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room) return res.sendStatus(404)

  let doc = new HTMLDocument(new RoomView({ roomStateData: room.getStateData() }))
  res.send(`${doc.toHTML()}`)
})

// room EventSource stream, causes a join announce too
let userTimeouts = new WeakMap()
app.get('/:roomID/event-stream', requireSignature, (req, res) => {
  let room = rooms[req.params.roomID]

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
  if (!room) return append({uuid: 0, data: { error: "Specified room doesn't exist" }})
  if (!req.query.attributes) return append({ uuid: 0, error: "attributes property required in query string" })
  
  // subscribe to room log and continue streaming out log updates
  room.log.on('append', append)

  // if user isn't in the room already, join the room
  if (!room.getPerson(req.sig.identity)) {
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
  let room = rooms[req.params.roomID]
  if (!room) return res.status(500).send({ error: "Specified room doesn't exist" })
  if (req.body.leave !== true) return res.status(500).send({ error: "Request body must include { leave: true } property" })
  try { room.personLeave(req.sig.identity) }
  catch (err) { return res.status(500).send({ error: err.message }) }
  res.send({ ok: true })
})

// user can request to update their attributes
app.post('/:roomID/set-attributes', requireSignature, (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room) return res.status(500).send({ error: "Specified room doesn't exist" })
  let person = room.getPerson(req.sig.identity)
  if (!person) return res.status(500).send({ error: "User is not in room, cannot update" })

  if (!Array.isArray(req.body.updates)) return res.status(500).send({ error: "updates property in body must be array" })
  let prefixedUpdates = req.body.updates.map(([path, value]) => [['attributes', ...path], value])
  room.personChange(req.sig.identity, prefixedUpdates)
  res.send({ ok: true })
})

// when a user sends a message to the room, publish that
app.post('/:roomID/send', requireSignature, (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room) return res.status(500).send({ error: "Specified room doesn't exist" })
  if (!room.getPerson(req.sig.identity)) return res.status(500).send({ error: "User is not in room, cannot send message" })
  room.send(req.sig.identity, req.body)
  res.send({ ok: true })
})

// upload an avatar to user's object as a data uri, streamed out over event streams
app.post('/:roomID/avatar', requireSignature, (req, res)=> {
  let room = rooms[req.params.roomID]
  if (!room) return res.status(500).send({ error: "Specified room doesn't exist" })
  let person = room.getPerson(req.sig.identity)
  if (!person) return res.status(500).send({ error: "You are not in this room, you can't publish an avatar yet" })
  if (req.get('Content-Type') != config.avatarMimeType) return res.status(500).send({ error: "Post body must be a JPEG" })

  if (!Buffer.isBuffer(req.body)) return res.status(500).send({ error: "Image data didn't arrive as a buffer??" })
  if (req.body.byteLength > config.avatarMaxData) return res.status(500).send({ error: "Image data is too large in bytes" })
  if (req.body.byteLength < 8) return res.status(500).send({ error: "Image data is too small in bytes" })
  
  let size = sizeOf(req.body)
  if (size.width != config.avatarSize) return res.status(500).send({ error: "Avatar width is incorrect" })
  if (size.height != config.avatarSize) return res.status(500).send({ error: "Avatar height is incorrect" })
  if (`image/${size.type.replace('jpg', 'jpeg')}` != config.avatarMimeType) return res.status(500).send({ error: "File data does not look like JPEG" })

  // it all validates, so we can let the client know it's accepted now
  res.send({ ok: true })

  // encode JPEG to a data uri
  let datauri = `data:${req.get('Content-Type')};base64,${encodeURIComponent(req.body.toString('base64'))}`

  // setup a change log to apply efficiently
  let changes = []
  // add any missing structure or values
  if (person.avatar === undefined)
    changes.push(['avatar', {}])
  if (person.avatar.width !== size.width)
    changes.push(['avatar.width', size.width])
  if (person.avatar.height !== size.height)
    changes.push(['avatar.height', size.height])
  if (person.avatar.type !== req.get('Content-Type'))
    changes.push(['avatar.type', req.get('Content-Type')])
  if (person.avatar.src !== datauri)
    changes.push(['avatar.src', datauri])
  
  if (changes.length > 0) { // we have something to update! timestamp it and send it out to the subscribers
    changes.push(['avatar.timestamp', Date.now()])
    room.personChange(person.identity, changes)
  }
})

module.exports = app