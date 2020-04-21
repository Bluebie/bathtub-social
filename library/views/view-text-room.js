// this is just a testing room, which creates a text channel UI to test the functions of the server side rooms thing

// Builds frontend main single page application markup
const html = require('nanohtml')
const base = require('./provider-base')
const TextComposer = require('./component-text-composer')
const PresenceList = require('./component-presence-list')
const ChatLog = require('./component-chat-log')

class TextRoomView extends base {
  constructor(roomID) {
    super()
    this.roomID = roomID
  }

  getPageType() {
    return "text-room"
  }

  getData() {
    return { roomID: this.roomID }
  }

  toHTML() {
    return html`<div class="text-room-container">
      ${(new ChatLog()).render()}
      ${(new PresenceList()).render({})}
      ${(new TextComposer()).render()}
    </div>`
  }
}

module.exports = TextRoomView