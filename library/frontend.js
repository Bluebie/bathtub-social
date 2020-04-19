const config = require('../package.json').bathtub
const P2P = require('simple-peer')
const RoomClient = require('./client-data/room')
const html = require('nanohtml')
const morph = require('nanomorph')
const ChatBubbleComponent = require('./views/component-chat-bubble')
const PresenceListComponent = require('./views/component-presence-list')

// shortcuts
const qsa = (q) => document.querySelectorAll(q)
const qs = (q) => document.querySelector(q)

let chatLogComponents = []

function renderChatLog() {
  // remove old messages
  while (chatLogComponents.length > 100) chatLogComponents.shift()
  // update chatlog
  morph(qs('.text-room-log'), html`<div class="text-room-log">${chatLogComponents.map(x => x.render())}</div>`)
  setTimeout(()=> qs('.text-room-log').scrollTop = 999999999)
}

async function run() {
  let { roomID } = JSON.parse(document.body.dataset.json)
  console.log('Room ID:', roomID)

  let room = await RoomClient.getRoom({ roomID })
  console.log('Room:', room)

  window.room = room

  room.on('text', ({identity, message}) => {
    console.log("Text", {identity, message})
    let person = room.getPerson(identity)
    if (!person) return console.error("Person doesn't exist with ID", identity)

    let bubble = new ChatBubbleComponent(room, identity, `${person.attributes.name}: ${message}`)
    chatLogComponents.push(bubble)

    renderChatLog()
  })

  qs('form').onsubmit = (event) => {
    room.text(qs('input[type=text]').value)
    qs('input[type=text]').value = ''
    event.preventDefault()
    return false
  }

  // handle presence updates
  let presenceList = new PresenceListComponent()
  room.on('peopleChange', () => {
    if (presenceList.update(room.people)) {
      morph(qs('.presence-component'), presenceList.render(room.people))
    }

    renderChatLog()
  })

  let name = prompt("What's your name?")
  let hue = Math.round(Math.random() * 360)
  let xPosition = Math.random()
  room.join({ name, hue, xPosition })
}

window.onload = run