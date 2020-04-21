// component renders a single chat bubble
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')

class PresenceListComponent extends Nanocomponent {
  constructor({room, onClick} = {}) {
    super()
    this.room = room || { people: {} }
    this.peopleJSON = null
    this.onClick = onClick || ((person) => { console.log("Presence Click:", person)})
  }

  handleClick(person) {
    this.onClick(person)
  }

  createElement() {
    let pieces = Object.values(this.room.people).map((person)=> 
      html`<div class="person" style="--hue: ${person.attributes.hue}" onclick=${()=> this.handleClick(person)}>${person.attributes.name}</div>`
    )
    return html`<div class="presence-list">${pieces}</div>`
  }

  update() {
    let newJSON = JSON.stringify(room.people)
    if (newJSON == this.peopleJSON) return false
    this.peopleJSON = newJSON
    return true
  }
}

module.exports = PresenceListComponent