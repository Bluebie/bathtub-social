// Component which implements a horizontal line of video players, suitable for hosting WebRTC streams or webcams
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const parseDuration = require('parse-duration')
const delay = require('delay')

module.exports =
class VideoCrossbarComponent extends nanocomponent {
  constructor({  } = {}) {
    super()
    this.attachedPeople = new Set()
  }

  // add a new video player, representing a particular person at a particular angle
  addPlayer({ person, angle }) {
    let player = this.getPlayer(person)
    if (!player) {
      player = new this.constructor.Player({ person, angle })
      this.attachedPeople.add(player)
    } else if (typeof(angle) == 'number') {
      player.setAngle(angle)
    }
    this.rerender()
  }

  // get an array of all current players
  getPlayers() {
    return [...this.attachedPeople]
  }

  // get a specific player by providing the same person object used to create it with the addPlayer method
  getPlayer(person) {
    return this.getPlayers().find(player => player.isPerson(person))
  }

  // gets an array of players
  getSortedPlayers() {
    return this.getPlayers().sort((x,y) => this.relativeAngle(x, y))
  }

  // returns positive number if passed in player should be to the right of this player
  // returns 0 if equivilently positioned
  // returns negative number if passed in player should be to the left of this one
  getRelativeAngle(angle1, angle2) {
    return angle2 - angle1
  }

  // returns a 0 or positive number of angular degrees between this player and the passed in player
  getAngularDistance(angle1, angle2) {
    return Math.abs(this.getRelativeAngle(angle1, angle2))
  }

  // create the initial container element
  createElement() {
    let players = this.getSortedPlayers()
    let components = []

    // if there are any players, add them to the list with prepended spacers
    if (players.length > 0) {
      components = players.flatMap((player, idx)=> [
        // create a spacer that takes up horizontal space
        VideoCrossbarComponent.createSpacer(this.getAngularDistance((players[idx-1] || { angle: 0 }).angle, player.angle)),
        // render the player element itself
        player.render(),
      ])
      // and also add one final spacer to position everything just right with the angles
      components.push(
        VideoCrossbarComponent.createSpacer(this.getAngularDistance(players.slice(-1)[0].angle, { angle: 360 })),
      )
    }

    let styleString = `direction: ltr`
    return html`<div class="video-crossbar" style="${styleString}">
      ${components}
    </div>`
  }

  // disable nanocomponent updates, it's all handled in functions
  update() {
    return false  
  }
}

module.exports.Player = class VideoCrossbarPlayer extends nanocomponent {
  constructor({ person, angle }) {
    super()
    this.person = person
    this.angle = typeof(angle) == 'number' ? angle : Math.random() * 360.0
  }

  isPerson(person) {
    return this.person === person
  }

  // sets the stream the video plays to a certain object/string
  setStream(stream) {
    this.element.src = stream
  }

  // gets the inline style string this element should have
  getStyleString() { return `--hue: ${parseFloat(this.person.attributes.hue)}deg` }

  // create initial html element using nanohtml
  createElement() {
    return html`<video class="crossbar-player" autoplay playsinline style="${this.getStyleString()}"></video>`
  }

  // update styling of this player
  update() {
    this.element.setAttribute('style', this.getStyleString())
    return false
  }
}

// horizontal spacer to position the video players using flex box
module.exports.createSpacer = (grow)=> {
  let styleString = `flex-grow: ${Math.abs(parseFloat(grow))}`
  return html`<div class="video-crossbar-spacer" style="${styleString}"></div>`
}
