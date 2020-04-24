// component renders a single chat bubble
// accepts options:
//   text: the text message (as a string or nanohtml elements) to show in the bubble
//   person: a room person object which contains { attributes: { xPosition: 0.0 - 1.0, hue: 0.0-360.0 user's identity color preference }}
//   onClick: a function which executes when the component is clicked
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class ChatBubbleComponent extends Nanocomponent {
  constructor({ person, text, onClick } = {}) {
    super()
    this.person = person
    this.text = text
    this.onClick = onClick
    this.created = Date.now()
    this.expiring = false
    this.expired = false
    this.style = {}
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  createElement() {
    let { hue, x } = this.person.attributes
    this.cacheKey = [hue, x, this.text]
    this.style['--x'] = x
    this.style['--hue'] = hue

    return html`<div class="bubble-row" style="${Object.entries(this.style).map(([k,v])=> `${k}:${v}`).join(';')}">
      <div class="spacer left"></div>
      <div class="bubble" onclick=${this.handleClick}>${this.text}</div>
      <div class="spacer right"></div>
    </div>`
  }

  update() {
    let { hue, x } = this.person.attributes
    let cacheKey = this.cacheKey || []
    return [hue, x, this.text].some((value, index) => cacheKey[index] != value)
  }
}

module.exports = ChatBubbleComponent