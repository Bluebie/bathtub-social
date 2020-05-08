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


// filmstrip RAM storage
let filmstripsData = new WeakMap()
let filmstripInterval = parseDuration(config.filmstripInterval)
let filmstripExpires = filmstripInterval * 4
// upload a filmstrip to server memory
app.post('/:roomID/filmstrips', requireSignature, (req, res)=> {
  let room = rooms[req.params.roomID]
  if (!room) return res.status(500).send({ error: "Specified room doesn't exist" })
  let person = room.getPerson(req.sig.identity)
  if (!person) return res.status(500).send({ error: "You are not in this room, you can't publish a filmstrip yet" })
  if (req.get('Content-Type') != "image/jpeg") return res.status(500).send({ error: "Post body must be a JPEG" })

  if (!Buffer.isBuffer(req.body)) return res.status(500).send({ error: "Image data didn't arrive as a buffer??" })
  if (req.body.byteLength > config.filmstripMaxData) return res.status(500).send({ error: "Image data is too large in bytes" })
  if (req.body.byteLength < 16) return res.status(500).send({ error: "Image data is too small in bytes" })
  
  let size = sizeOf(req.body)
  if (size.width != config.filmstripSize) return res.status(500).send({ error: "Filmstrip width is incorrect" })
  if (size.height != config.filmstripSize * config.filmstripFrames) return res.status(500).send({ error: "Filmstrip height is incorrect" })
  if (size.type != 'jpg') return res.status(500).send({ error: "File data does not look like JPEG" })

  filmstripsData.set(person, req.body)

  let filmstamp = Math.round((Date.now() - person.joined) / 250).toString(36)
  room.personChange(person.identity, [["filmstamp"], filmstamp])

  req.send({ ok: true, filmstamp })
})

app.get('/:roomID/filmstrips/:identity/:timestamp', (req, res)=> {
  let room = rooms[req.params.roomID]
  if (!room) return res.status(500).send({ error: "Specified room doesn't exist" })
  let person = room.getPerson(req.sig.identity)
  if (!person) return res.status(404).send({ error: "Specified person identity doesn't exist in this room" })

  let data = filmstripsData.get(person)
  if (data) {
    res.set('Content-Type', 'image/jpeg')
    res.set('Cache-Control', `max-age=${Math.ceil(filmstripExpires / 1000)}`)
    res.send(data)
  } else {
    res.status(404).send({ error: "No filmstrip data available for this user" })
  }
})

module.exports = app