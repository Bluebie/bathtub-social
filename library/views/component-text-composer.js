// component renders a text composer form
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class PresenceListComponent extends Nanocomponent {
  constructor(onMessage) {
    super()
    this.onMessage = onMessage || console.log
  }

  onSubmit(event) {
    let data = new FormData(e.currentTarget)
    this.onMessage(data.get('text'))
  }

  createElement() {
    return html`<form class="text-composer" onsubmit=${this.onSubmit}>
      <input type="text" name="text" value="">
      <button type="submit">Send</button>
    </form>`
  }

  update() {
    return false
  }
}

module.exports = PresenceListComponent