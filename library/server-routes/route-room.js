const express = require('express')
const fs = require('fs-extra')
const appRoot = require('app-root-path')
const SSE = require('sse-writer')
const config = require('../../package.json').bathtub
const Room = require('../server-data/room')
const { signedMiddleware, requireSignature } = require('../crypto/parse-request')
const parseDuration = require('parse-duration')

const HTMLDocument = require('../views/html-document')
const TextRoomView = require('../views/view-text-room')

// load room configurations
let rooms = {}
fs.readdirSync(appRoot.resolve('configuration/rooms')).forEach(roomFilename => {
  let roomConfig = JSON.parse(fs.readFileSync(appRoot.resolve(`configuration/rooms/${roomFilename}`)))
  let room = new Room(roomConfig)
  rooms[roomConfig.roomID] = room
})

app = express.Router({})

app.use(signedMiddleware)

// get public info about rooms or a specific room
app.get('/', (req, res) => res.send(Object.values(rooms).map(room => room.getPublicInfo())) )
app.get('/:roomID/', (req, res) => res.send(rooms[req.params.roomID].getPublicInfo()) )

// render user interface
app.get('/:roomID/text', async (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room) return res.status(404).send({ error: "specified room does not exist" })

  let doc = new HTMLDocument({ title: `${room.humanName || room.roomID} - Development Text Chat` })
  await doc.setBody(new TextRoomView(room.roomID))
  res.send(doc.toHTML().toString())
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
      return res.status(429).send({ error: err.message })
    }
  }

  // get person object
  let person = room.getPerson(req.sig.identity)

  // when user disconnects, clean up events
  req.on('aborted', () => {
    console.log("Aborted", req.sig.identity)
    room.log.off('append', append)
    userTimeouts.set(person, setTimeout(() => {
      room.personLeave(req.sig.identity)
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
  if (req.body.leave !== true) return res.status(500).send({ error: "Request body must include { leave: true } property" })
  try { room.personLeave(req.sig.identity) }
  catch (err) { return res.status(500).send({ error: err.message }) }
  res.send({ ok: true })
})

// user can request to update their attributes
app.post('/:roomID/set-attributes', requireSignature, (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room.getPerson(req.sig.identity)) return res.status(500).send({ error: "User is not in room, cannot update" })
  if (!req.body.attributes) return res.status(500).send({ error: "attributes property in body is not optional" })
  room.personChange(req.sig.identity, { attributes: req.body.attributes })
  res.send({ ok: true })
})

// when a user sends a message to the room, publish that
app.post('/:roomID/send', requireSignature, (req, res) => {
  let room = rooms[req.params.roomID]
  if (!room.getPerson(req.sig.identity)) return res.status(500).send({ error: "User is not in room, cannot send message" })
  room.send(req.sig.identity, req.body)
  res.send({ ok: true })
})

module.exports = app