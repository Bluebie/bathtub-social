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
    this.style = {
      "margin-top": '1em',
      "opacity": '0.0',
    }
    this.handleClick = this.handleClick.bind(this)
    this.handleTransitionEnd = this.handleTransitionEnd.bind(this)
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  // called by ChatLogComponent when it's about to remove this entry, element is removed once this promise resolves
  async handleExpire() {
    this.style["margin-top"] = `-${this.element.offsetHeight}px`
    this.style["opacity"] = '0.0'
    // alter classes to provoke a transition animation, returns when animation is complete
    this.rerender()
    return new Promise((resolve, reject) => {
      this.onTransitionEnd = resolve
    })
  }

  handleTransitionEnd() {
    if (this.onTransitionEnd) this.onTransitionEnd()
  }

  createElement() {
    let { hue, x } = this.person.attributes
    this.cache = JSON.stringify([hue, x, this.text])
    this.style['--x'] = x
    this.style['--hue'] = hue

    return html`<div class="bubble-row" style="${Object.entries(this.style).map(([k,v])=> `${k}:${v}`).join(';')}" ontransitionend=${this.handleTransitionEnd}>
      <div class="spacer left"></div>
      <div class="bubble" onclick=${this.handleClick}>${this.text}</div>
      <div class="spacer right"></div>
    </div>`
  }

  // called by nanocomponent when the node is inserted in to the DOM
  load(element) {
    // animate bubble in
    this.style['opacity'] = '1.0'
    this.style['margin-top'] = '0'
    this.rerender()
  }

  update() {
    let { hue, x } = this.person.attributes
    return JSON.stringify([hue, x, this.text]) != this.cache
  }
}

module.exports = ChatBubbleComponent