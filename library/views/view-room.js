// this is just a testing room, which creates a text channel UI to test the functions of the server side rooms thing
const html = require('nanohtml')
const nanocomponent = require('nanocomponent')

const TextComposer = require('./component-text-composer')
const VideoCrossbar = require('./component-video-crossbar')
const LayerMap = require('../map2/map')
const ChatLog = require('./component-chat-log')
const RoomClient = require('../client-data/room')
const HueRing = require('./widget-hue-ring')
const AvatarCapture = require('./widget-avatar-capture')

const bathtub = require('../../package.json').bathtub

class RoomView extends nanocomponent {
  constructor(options) {
    super()
    this.options = options

    this.room = new RoomClient(options.roomStateData)
    this.crossbar = new VideoCrossbar({ })
    this.messages = new ChatLog({ expires: '30s' })
    this.map = new LayerMap({ })
    this.composer = new TextComposer({ })
  }

  get title() {
    return `${this.room.humanName} — ${bathtub.siteName}`
  }

  createElement() {
    return html`<body class="bathtub-room">
      <div class="vertical-flex">
        <div class="expand stack">
          ${this.crossbar.render()}
          ${this.map.render()}
          ${this.messages.render()}
        </div>
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

    // hook up the layer map
    this.map.room = this.room
    this.room.on('roomChange', async ()=> {
      document.title = this.title
      await this.map.loadArchitecture(this.room.architectureName, this.room.architecture)
      this.map.render()
    })

    // when people change their attributes, update anything that depends on that data
    this.room.on('peopleChange', ()=> {
      this.messages.render()
    })

    this.room.on('personJoin', person => this.map.render() )
    this.room.on('personLeave', person => this.map.render() )
    this.room.on('personChange', (person, changes) => this.map.handlePersonChange(person, changes) )

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

    if (this.map.loadArchitecture) {
      await this.map.loadArchitecture(this.room.architectureName, this.room.architecture)
      this.map.render()
    }

    this.map.onMoveTo = (position)=> {
      this.room.updateAttributes({ x: position.x, y: position.y })
    }

    // join room
    this.room.join({
      hue: Math.round(Math.random() * 360),
      ... this.room.architecture.spawn,
    })

    // ask for webcam feed (depends on user permission)
    // this.webcam = await navigator.mediaDevices.getUserMedia({
    //   video: {
    //     width: 640,
    //     height: 480,
    //     frameRate: { ideal: 60, min: 10 },
    //     facingMode: "user", // front facing camera please
    //   },
    //   audio: false
    // })
    // // send video feed to a hidden video tag
    // // todo: refactor this in to something nice
    // if (this.webcam) {
    //   this.handMirror = html`<video muted playsinline></video>`
    //   this.handMirror.srcObject = this.webcam
    //   this.handMirror.play()

    //   // setup filmstrip builder, which watches webcam handmirror and saves frames in to the strip
    //   // and uploads each strip to the server when they're done
    //   this.avatar = new AvatarCapture({
    //     source: this.handMirror,
    //     onAvatar: (buffer) => {
    //       this.room.uploadAvatar(buffer)
    //     }
    //   })
    //   this.avatar.enable()
    // } else {
    //   console.log("no webcam??")
    // }
  }

  update() {
    return true
  }
}

module.exports = RoomView