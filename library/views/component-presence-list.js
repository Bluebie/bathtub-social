// component renders a single chat bubble
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class PresenceListComponent extends Nanocomponent {
  constructor() {
    super()
    this.peopleJSON = null
  }

  createElement(people) {
    let pieces = Object.values(people).map((person)=> 
      html`<div data-identity="${person.identity}" class="person" style="--hue: ${person.attributes.hue}">${person.attributes.name}</div>`
    )
    return html`<div class="presence-component">${pieces}</div>`
  }

  update(people) {
    let newJSON = JSON.stringify(people)
    if (newJSON != this.peopleJSON) {
      return true
    }
  }
}

module.exports = PresenceListComponent