// component renders a single chat bubble
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class ChatBubbleComponent extends Nanocomponent {
  constructor() {
    super()
    this.hue = '0deg'
    this.pointerOffset = '0px'
    this.text = ""
  }

  createELement() {
    return html`<div class="bubble" style="--hue: ${this.hue}; --pointer-offset: ${this.pointerOffset}">${this.text}</div>`
  }

  update({hue, pointerOffset, text}) {
    this.hue = hue || this.hue
    this.pointerOffset = pointerOffset || this.pointerOffset
    this.text = text || this.text
  }
}

module.exports = ChatBubbleComponent