// this is just a testing room, which creates a text channel UI to test the functions of the server side rooms thing

// Builds frontend main single page application markup
const html = require('nanohtml')
const raw = require('nanohtml/raw')
const fs = require('fs-extra')

const appRootPath = require('app-root-path')
const base = require('./provider-base')

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
      <div class="text-room-log"></div>
      <div class="text-room-presence"></div>
      <form class="text-room-composer">
        <input type="text" id="text-composer">
        <input type="submit" id="text-submit-button" value="Send">
      </form>
    </div>`
  }
}

module.exports = TextRoomView