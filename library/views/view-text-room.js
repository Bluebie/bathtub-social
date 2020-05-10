// this is just a testing room, which creates a text channel UI to test the functions of the server side rooms thing
const html = require('nanohtml')
const nanocomponent = require('nanocomponent')

const TextComposer = require('./component-text-composer')
const PresenceList = require('./component-presence-list')
const ChatLog = require('./component-chat-log')
const RoomClient = require('../client-data/room')
const HueRing = require('./widget-hue-ring')
const Filmstrip = require('./widget-filmstrip-builder')

class TextRoomView extends nanocomponent {
  constructor(options) {
    super()
    this.options = options

    this.room = new RoomClient({ roomID: this.options.roomID })
    this.messages = new ChatLog({ expires: '30s' })
    this.presence = new PresenceList({ })
    this.composer = new TextComposer({ })
  }

  createElement() {
    return html`<body class="text-room">
      <div class="text-room-container">
        ${this.messages.render()}
        ${this.presence.render()}
        ${this.composer.render()}
      </div>
    </body>`
  }

  // on load
  async load() {
    // hookup event handlers and other stuff that shouldn't happen server side
    // handle clicks on text chat bubbles
    this.messages.onClick = (mouseEvent, type, chatBubble) => {
      // if it's one of your own bubbles:
      if (this.room.identity.equals(chatBubble.person.identity)) {
        // generate a HueRing widget to pick a different identity color
        new HueRing({
          hue: chatBubble.person.attributes.hue,
          position: mouseEvent,
          onChoice: (newHue)=> {
            this.room.updateAttributes({ hue: newHue })
          }
        })
      }
    }

    // when a user submits a text message in the text composer, send it to the room
    this.composer.onMessage = (text)=> {
      this.room.text(text)
    }

    // hook the presence list up to the room
    this.presence.room = this.room // use the room as it's data source
    // when the room has a peopleChange event, make sure to update any components that depend on people data
    this.room.on('peopleChange', ()=> {
      this.presence.render()
      this.messages.render()
    })

    // when text messages come in from the server, append them and trigger rendering of Chat Log Component
    this.room.on('text', ({identity, message}) => {
      let person = this.room.getPerson(identity)
      if (!person) return console.error("Person doesn't exist with ID", identity)
      this.messages.appendText(person, `${message}`)
      this.messages.render()
    })

    // when user closes window or navigates away, attempt to notify server they left
    window.addEventListener("beforeunload", ()=> {
      this.room.leave()
    })

    // join room
    this.room.join({
      hue: Math.round(Math.random() * 360),
      x: Math.random(), y: Math.random(),
    })

    // ask for webcam feed (depends on user permission)
    this.webcam = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 480,
        frameRate: { ideal: 60, min: 10 },
        facingMode: "user", // front facing camera please
      },
      audio: false
    })
    // send video feed to a hidden video tag
    // todo: refactor this in to something nice
    if (this.webcam) {
      this.handMirror = html`<video muted playsinline></video>`
      this.handMirror.srcObject = this.webcam
      this.handMirror.play()

      // setup filmstrip builder, which watches webcam handmirror and saves frames in to the strip
      // and uploads each strip to the server when they're done
      this.filmstrip = new Filmstrip({
        source: this.handMirror,
        onFilmstrip: (buffer) => {
          this.room.updateFilmstrip(buffer)
        }
      })
      this.filmstrip.enable()
    } else {
      console.log("no webcam??")
    }
  }
}

module.exports = TextRoomView