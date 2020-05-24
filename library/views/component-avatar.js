// component renders a user avatar
const uri = require('encodeuricomponent-tag') // uri encodes template literals

const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')

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
  constructor({ person, onClick, style } = {}) {
    super()
    this.person = person
    this.style = new StyleObject(style)
    this.onClick = onClick
    this.handleClick = this.handleClick.bind(this)
  }

  // returns an object with every important piece of information used by this component, for element cache invalidation
  get inputs() {
    let { hue, x, y, authority, decoration } = this.person.attributes
    return { hue, x, y, authority, decoration, webcam: this.person.avatar }
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  createElement() {
    let { hue, x, y, authority, decoration, webcam } = this.lastRenderInputs = this.inputs
    this.style.setVariables({ hue, x, y })

    let elements = []
    if (this.person.avatar !== undefined && this.person.avatar.src !== undefined) {
      elements.push(html`<img class="image" src="${webcam.src}" width="${webcam.width}" height="${webcam.height}">`)
    } else {
      elements.push(html`<span class="image awaiting-image"></span>`)
    }

    if (decoration && !decoration.match(/Admin/i)) {
      elements.push(avatarDecoration(decoration))
    }

    if (authority == 'Admin') {
      elements.push(avatarDecoration('Admin Swoops'))
    }

    return html`<div class="avatar" style="${this.style}">${elements}</div>`
  }

  // update when the inputs changed
  update() {
    return !deepEql(this.state, this.lastRenderInputs)
  }
}

module.exports = AvatarComponent