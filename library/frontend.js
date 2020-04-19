const config = require('../package.json').bathtub
const P2P = require('simple-peer')
const RoomClient = require('./client-data/room')
const Nanomap = require('nanomap')
const morph = require('nanomorph')
const ChatBubbleComponent = require('./views/component-chat-bubble')

// shortcuts
const qsa = (q) => document.querySelectorAll(q)
const qs = (q) => document.querySelector(q)

let chatLog = []
let chatLogMapper = new Nanomap({ gc: true }, ChatBubbleComponent)

async function run() {
  let { roomID } = JSON.parse(document.body.dataset.json)
  console.log('Room ID:', roomID)

  let room = await RoomClient.getRoom({ roomID })
  console.log('Room:', room)

  let name = 'Phoenix' //prompt("What's your name?")
  let hue = Math.round(Math.random() * 360) + 'deg'
  let pointerOffset = Math.round(Math.random() * 300) + 'px'
  room.join({ name, hue, pointerOffset })

  room.on('text', ({identity, message}) => {
    let person = room.getPerson(identity)
    chatLog.push({
      hue: person.attributes.hue,
      pointerOffset: person.attributes.pointerOffset,
      text: `${person.attributes.name}: ${message}`
    })
    // remove old messages
    while (chatLog.length > 10) chatLog.shift()
    // update chatlog
    morph(qs('.text-room-log'), html`<div class="chat-room-log">${chatLog.map(chatLogMapper)}</div>`)
  })

  qs('form').onsubmit = (event) => {
    room.text(qs('input[type=text]').value)
    qs('input[type=text]').value = ''
    event.preventDefault()
    return false
  }

  // presence
  room.on('peopleChange', () => {
    let peopleDivs = Object.values(room.people).map(person => 
      html`<div class="person" data-identity="${person.identity}">${person.attributes.name}</div>`
    )
    morph(qs('div.text-room-presence'), html`<div class="text-room-presence">${peopleDivs}</div>`)
  })
}

window.onload = run