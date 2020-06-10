// component renders a user avatar
const nanocomponent = require('nanocomponent')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const html = require('nanohtml')
const css = require('sheetify')
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')
const anime = require('animejs')
const config = require('../../package.json').bathtub

const prefix = css`
  :host {
    width: 128px; height: 128px;
  }

  :host > * {
    position: absolute;
    display: block;
  }

  :host > .decoration {
    width: 100%; height: 100%;
  }

  :host > .image {
    width: 64px; height: 64px;
    box-sizing: border-box;
    margin: 32px;
    border: 3px solid transparent;
    border-radius: 50%;

    background-image:
      linear-gradient(to top,    hsl(var(--hue), 75%, 70%), hsl(var(--hue), 85%, 50%)),
      linear-gradient(to bottom, hsl(var(--hue), 75%, 65%), hsl(var(--hue), 85%, 55%));
    background-origin: border-box;
    background-clip: content-box, border-box;
  }

  :host.myself > .image {
    transform: scaleX(-1);
  }

  :host > .image.awaiting-image {
    box-shadow: inset 0px 3px 5px 3px hsla(var(--hue), 75%, 40%, 0.5);
  }
`


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
    let { hue, authority, decoration } = this.person.attributes
    return {
      hue, authority, decoration,
      isMyself: this.isMyself,
      webcam: this.person.avatar ? this.person.avatar.src : null,
    }
  }

  handleClick(event) {
    if (this.onClick) this.onClick(event, this)
  }

  createElement() {
    let { hue, authority, decoration, isMyself, webcam } = this.lastRenderInputs = this.inputs
    this.style.setVariables({ hue })

    let classList = [prefix]
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