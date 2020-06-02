// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')

// simple nanocomponent representing a map layer
class MapLayer extends nanocomponent {
  constructor({ map, layerIndex }) {
    super()
    this.map = map
    this.room = map.room
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
      url: this.config.url,
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
    let { url, x, y, width, height, viewport } = this.renderedInputs = this.inputs
    
    // update location
    this.style.set({
      left: `${(x * viewport.width) - (width / 2)}px`,
      top: `${(y * viewport.height) - height}px`,
      width: `${width}px`,
      height: `${height}px`,
    })

    // render html
    return html`<img class="layer" src="${this.assetURL(url)}" style="${this.style}">`
  }

  // update if the viewport changed size, or if the architecture was changed by the server
  update() {
    return !deepEql(this.inputs, this.renderedInputs)
  }
}

module.exports = MapLayer
