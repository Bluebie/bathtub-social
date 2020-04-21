// component renders a text composer form
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class PresenceListComponent extends Nanocomponent {
  constructor({ onMessage } = {}) {
    super()
    this.loaded = false
    this.onMessage = onMessage || console.log
    this.onSubmit = this.onSubmit.bind(this)
  }

  onSubmit() {
    let input = this.element.querySelector('input[name=text]')
    this.onMessage(input.value)
    input.value = ''
    event.preventDefault()
    return false
  }

  createElement() {
    if (this.loaded) {
      return html`<form class="text-composer" onsubmit=${this.onSubmit}>
        <input type="text" name="text" autocomplete="off" value="">
        <button type="submit">Send</button>
      </form>`
    } else {
      return html`<form class="text-composer" onsubmit="return false">
        <input type="text" name="text" autocomplete="off" value="" disabled>
        <button type="submit" disabled>Send</button>
      </form>`
    }
  }

  load() {
    this.loaded = true
    this.rerender()
  }

  update() {
    return false
  }
}

module.exports = PresenceListComponent