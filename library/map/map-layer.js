// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')
const uuid = require('uuid').v4

// simple nanocomponent representing a map layer
class MapLayer extends nanocomponent {
  constructor({ map, layerIndex }) {
    super()
    this.map = map
    this.room = map.room
    this.id = `${uuid()}`
    this.layerIndex = layerIndex
    this.style = new StyleObject({
      position: 'absolute'
    })
  }

  get config() {
    return this.room.architecture.layers[this.layerIndex]
  }

  // returns an object with all the input data that's relevent to rendering this layer
  get inputs() {
    return {
      image: this.config.image,
      mask: this.config.mask,
      x: this.config.x === undefined ? 0.5 : this.config.x,
      y: this.config.y === undefined ? 1.0 : this.config.y,
      width: this.config.info.width * this.map.scale,
      height: this.config.info.height * this.map.scale,
      viewport: this.map.getViewport(),
    }
  }

  assetURL(filename) {
    return this.room.architecturePath + uri`/${filename}`
  }

  createElement() {
    this.cacheKey = this.stateKey
    let { image, mask, x, y, width, height, viewport } = this.renderedInputs = this.inputs
    
    // update location
    this.style.set({
      left: `${Math.round((x * viewport.width) - (width / 2))}px`,
      top: `${Math.round((y * viewport.height) - height)}px`,
      width: `${Math.round(width)}px`,
      height: `${Math.round(height)}px`,
    })

    if (mask) {
      let maskImageElement = html`<image width="100%" height="100%" href="${this.assetURL(mask)}"></image>`
      let maskElement = html`<mask id="mask-${this.id}" mask-type="luminance">${maskImageElement}</mask>`
      let defsElement = html`<defs>${maskElement}</defs>`
      let imageElement = html`<image width="100%" height="100%" href="${this.assetURL(image)}" mask="url(#mask-${this.id})"></image>`
      return html`<svg class="layer" style="${this.style}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${defsElement}${imageElement}</svg>`
    } else {
      return html`<img class="layer" src="${this.assetURL(image)}" style="${this.style}">`
    }
  }

  // update if the viewport changed size, or if the architecture was changed by the server
  update() {
    return !deepEql(this.inputs, this.renderedInputs)
  }
}

module.exports = MapLayer
