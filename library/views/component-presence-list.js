// component renders a single chat bubble
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const Avatar = require('./component-avatar')

class PresenceListComponent extends Nanocomponent {
  constructor({room, onClick} = {}) {
    super()
    this.room = room || { people: {} }
    this.peopleJSON = null
    this.onClick = onClick || ((person) => { console.log("Presence Click:", person)})
    this.avatarMap = new WeakMap()
    this.peopleKeyCache = []
  }

  handleClick(person) {
    this.onClick(person)
  }

  // gets an avatar for a person object
  // caching components in a WeakMap
  avatarForPerson(person) {
    let avatar = this.avatarMap.get(person)
    if (!avatar) {
      this.avatarMap.set(person, avatar = new Avatar({ room: this.room, person, onClick: ()=> this.handleClick(person)}))
    }
    return avatar
  }

  // create HTML element that will morph in to presence list containing all the avatars
  createElement() {
    let people = Object.values(this.room.people)
    let avatars = people.map(person => this.avatarForPerson(person))
    return html`<div class="presence-list">${avatars.map(a => a.render())}</div>`
  }

  // only do updates at this level when the members in the room change
  update() {
    let peopleKeys = Object.keys(this.room.people)
    let peopleChanged = peopleKeys.some((value, index) => this.peopleKeyCache[index] != value)
    this.peopleKeyCache = peopleKeys

    // if anyone's left or joined, rerender presence list
    if (peopleChanged) {
      return true
    } else { // otherwise, just ask the avatars to consider rerendering in place
      Object.values(this.room.people).forEach(person => this.avatarMap.get(person).render())
      return false
    }
  }
}

module.exports = PresenceListComponent