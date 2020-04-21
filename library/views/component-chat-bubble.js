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
    this.classList = new Set(["bubble-row"])
    this.handleClick = this.handleClick.bind(this)
    this.handleTransitionEnd = this.handleTransitionEnd.bind(this)
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  // called by ChatLogComponent when it's about to remove this entry, element is removed once this promise resolves
  async handleExpire() {
    // alter classes to provoke a transition animation, returns when animation is complete
    this.classList.delete('visible')
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

    return html`<div class="${[...this.classList].join(' ')}" style="--hue: ${hue}; --x: ${x}" ontransitionend=${this.handleTransitionEnd}>
      <div class="spacer left"></div>
      <div class="bubble" onclick=${this.handleClick}>${this.text}</div>
      <div class="spacer right"></div>
    </div>`
  }

  // called by nanocomponent when the node is inserted in to the DOM
  load(element) {
    // alter classes to provoke a transition animation
    this.classList.add('visible')
    this.rerender()
  }

  update() {
    let { hue, x } = this.person.attributes
    return JSON.stringify([hue, x, this.text]) != this.cache
  }
}

module.exports = ChatBubbleComponent