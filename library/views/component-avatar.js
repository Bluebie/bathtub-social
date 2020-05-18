// component renders a user avatar
const uri = require('encodeuricomponent-tag') // uri encodes template literals

const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const StyleObject = require('../features/style-object')

const config = require('../../package.json').bathtub

function avatarDecoration(decorationName) {
  let url = (filename)=> uri`/style/avatar-decorations/${filename}`
  let src = url(`${decorationName}.png`)
  let srcset = [
    `${src} 1x`,
    `${url(`${decorationName}@2x.png`)} 2x`,
    `${url(`${decorationName}@3x.png`)} 3x`
  ].join(',\n')
  return html`<img class="decoration" src="${src}" srcset="${srcset}" width=300 height=300>`
}

class AvatarComponent extends nanocomponent {
  constructor({ room, person, onClick } = {}) {
    super()
    this.room = room
    this.person = person
    this.style = new StyleObject
    this.onClick = onClick
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  createElement() {
    let { hue, x, y, decoration } = this.person.attributes
    this.style.setVariables({ hue, x, y })
    this.cacheKey = [hue, x, y, decoration, this.person.avatar.timestamp]

    let elements = []
    if (this.person.avatar !== undefined && this.person.avatar.src !== undefined) {
      elements.push(html`<img class="image" src="${this.person.avatar.src}" width="${this.person.avatar.width}" height="${this.person.avatar.height}">`)
    } else {
      elements.push(html`<span class="image awaiting-image"></span>`)
    }

    if (this.person.attributes.decoration) {
      elements.push(avatarDecoration(this.person.attributes.decoration))
    }

    return html`<div class="avatar" style="${this.style}">${elements}</div>`
  }

  update() {
    let { hue, x, y, decoration } = this.person.attributes
    return [hue, x, y, decoration, this.person.avatar.timestamp].some((value, index) => this.cacheKey[index] != value)
  }
}

module.exports = AvatarComponent