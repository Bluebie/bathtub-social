const config = require('../package.json').bathtub
const P2P = require('simple-peer')
const RoomClient = require('./client-data/room')
const html = require('nanohtml')
const morph = require('nanomorph')
const ChatLog = require('./views/component-chat-log')
const ChatBubble = require('./views/component-chat-bubble')
const PresenceList = require('./views/component-presence-list')
const TextComposer = require('./views/component-text-composer')
const HueRing = require('./views/widget-hue-ring')

// shortcuts
const qs = (q) => document.querySelector(q)

async function run() {
  let { roomID } = JSON.parse(document.body.dataset.json)
  let room = window.room = await RoomClient.getRoom({ roomID })

  // setup UI components
  let log = new ChatLog({
    expires: '30s',
    onClick: (mouseEvent, type, chatBubble) => {
      if (room.identity.equals(chatBubble.person.identity)) {
        new HueRing({
          hue: chatBubble.person.attributes.hue,
          position: mouseEvent,
          onChoice: (newHue)=> {
            room.updateAttributes({ hue: newHue })
          }
        })
      }
    }
  })
  qs('.chat-log').replaceWith(log.render())

  let composer = new TextComposer({
    onMessage: (text)=> {
      room.text(text)
    }
  })
  qs('.text-composer').replaceWith(composer.render())

  // handle presence updates
  let presence = new PresenceList({ room })
  room.on('peopleChange', () => {
    presence.render()
    log.render()
  })
  qs('.presence-list').replaceWith(presence.render())

  // handle room events
  room.on('text', ({identity, message}) => {
    let person = room.getPerson(identity)
    if (!person) return console.error("Person doesn't exist with ID", identity)
    log.appendText(person, `${person.attributes.name}: ${message}`)
    log.render()
  })

  // when user closes window or navigates away, attempt to notify server they left
  window.addEventListener("beforeunload", ()=> {
    room.leave()
  })

  // join room
  room.join({
    name: prompt("What's your name?"),
    hue: Math.round(Math.random() * 360),
    x: Math.random()
  })
}

window.onload = run