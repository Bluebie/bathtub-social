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
  constructor({ person, onClick, style, isMyself } = {}) {
    super()
    this.person = person
    this.style = new StyleObject(style)
    this.isMyself = isMyself
    this.onClick = onClick
    this.handleClick = this.handleClick.bind(this)
  }

  // returns an object with every important piece of information used by this component, for element cache invalidation
  get inputs() {
    let { hue, x, y, authority, decoration } = this.person.attributes
    return {
      hue, x, y, authority, decoration,
      isMyself: this.isMyself,
      webcam: this.person.avatar ? this.person.avatar.src : null,
    }
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  createElement() {
    let { hue, x, y, authority, decoration, isMyself, webcam } = this.lastRenderInputs = this.inputs
    this.style.setVariables({ hue, x, y })

    let classList = ['avatar']
    if (isMyself) classList.push('myself')

    let elements = []
    if (webcam) {
      elements.push(html`<img class="image" src="${webcam}">`)
    } else {
      elements.push(html`<span class="image awaiting-image"></span>`)
    }

    if (decoration && !decoration.match(/Admin/i)) {
      elements.push(avatarDecoration(decoration))
    }

    if (authority) {
      elements.push(avatarDecoration('Admin Swoops'))
    }

    return html`<div class="${classList.join(' ')}" style="${this.style}" data-identity="${this.person.identity}">${elements}</div>`
  }

  // update when the inputs changed
  update() {
    return !deepEql(this.inputs, this.lastRenderInputs)
  }
}

module.exports = AvatarComponent