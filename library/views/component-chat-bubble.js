// component renders a single chat bubble
// accepts options:
//   text: the text message (as a string or nanohtml elements) to show in the bubble
//   xPosition: a number between 0.0 and 1.0 representing how far across the component the pointer should be
//   hue: a number between 0 and 360 (degrees) representing the hue to shade the bubble with
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class ChatBubbleComponent extends Nanocomponent {
  constructor(room, identity, text) {
    super()
    this.room = room
    this.identity = identity
    this.text = text
    this.personCache = room.getPerson(identity)
  }

  createElement() {
    let person = this.room.getPerson(this.identity)
    if (!person) person = this.personCache
    else this.personCache = person
    this.cache = JSON.stringify([person, this.text])
    return html`<div class="bubble-row" style="--hue: ${person.attributes.hue}deg; --x: ${person.attributes.xPosition}">
      <div class="spacer left"></div>
      <div class="bubble">${this.text}</div>
      <div class="spacer right"></div>
    </div>`
  }

  update() {
    return JSON.stringify([this.room.getPerson(this.identity), this.text]) != this.cache
  }
}

module.exports = ChatBubbleComponent