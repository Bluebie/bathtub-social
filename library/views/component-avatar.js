// component renders a user avatar
const uri = require('encodeuricomponent-tag') // uri encodes template literals

const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const config = require('../../package.json').bathtub

class AvatarComponent extends nanocomponent {
  constructor({ room, person, onClick } = {}) {
    super()
    this.room = room
    this.person = person
    this.style = {}
    this.onClick = onClick
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  createElement() {
    let { hue, x, y } = this.person.attributes
    let filmstamp = this.person.filmstamp
    this.cacheKey = [hue, x, y, filmstamp]
    this.style['--x'] = x
    this.style['--y'] = y
    this.style['--hue'] = hue

    let apiPath = uri`/rooms/${this.room.roomID}/filmstrips/${this.person.identity}/${filmstamp}`
    let imgSrc = config.apiRoot + apiPath
    let imgTag = filmstamp ? html`<img class="filmstrip" src="${imgSrc}">` : html`<img class="awaiting-filmstrip">`

    return html`<div class="avatar" style="${Object.entries(this.style).map(([k,v])=> `${k}:${v}`).join(';')}">
      ${imgTag}
    </div>`
  }

  update() {
    let { hue, x, y } = this.person.attributes
    let filmstamp = this.person.filmstamp
    return [hue, x, y, filmstamp].some((value, index) => this.cacheKey[index] != value)
  }
}

module.exports = AvatarComponent