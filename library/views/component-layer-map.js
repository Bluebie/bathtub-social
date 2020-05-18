// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const mouseOffset = require('mouse-event-offset')
const PF = require('pathfinding')
const StyleObject = require('../features/style-object')
const bathtubConfig = require('../../package.json').bathtub

const Avatar = require('./component-avatar')
const pathfindingGridFromImage = require('../features/pathfinding-grid-from-image')

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

  get x() { return this.config.x === undefined ? 0.5 : this.config.x }
  get y() { return this.config.y === undefined ? 1.0 : this.config.y }
  get width() { return this.config.info.width * this.map.scale }
  get height() { return this.config.info.height * this.map.scale }
  get stateKey() { return JSON.stringify([this.map.getViewport(), this.config]) }

  assetURL(filename) {
    return this.room.architecturePath + uri`/${filename}`
  }

  createElement() {
    this.cacheKey = this.stateKey
    
    // update location
    let viewport = this.map.getViewport()
    this.style.left = `${(this.x * viewport.width) - (this.width / 2)}px`
    this.style.top = `${(this.y * viewport.height) - this.height}px`
    this.style.width = `${this.width}px`
    this.style.height = `${this.height}px`

    // render html
    return html`<img class="layer" src="${this.assetURL(this.config.url)}" style="${this.style}">`
  }

  // update if the viewport changed size, or if the architecture was changed by the server
  update() {
    return (this.cacheKey != this.stateKey)
  }
}

class LayerMapComponent extends nanocomponent {
  constructor({ room, onMoveTo, onClickPerson }) {
    super()
    this.room = room
    this.peopleKeyCache = []
    this.avatarMap = new WeakMap()
    this.onMoveTo = onMoveTo || ((location) => { console.log("Floor Position Click:", person)})
    this.handleClick = this.handleClick.bind(this)
    this.onClickPerson = onClickPerson

    this._weakmap = new WeakMap()
    this.style = new StyleObject()
    this.viewportStyle = new StyleObject()
  }

  // get graphics scale
  get scale() {
    return this.element.clientWidth / Math.max(...this.room.architecture.layers.map(x => x.info.width))
  }

  // gets a clone of the pathfinding grid for the current archtecture, cached when reused
  async getPathfindingGrid() {
    if (!this._baseGrid || this._baseGridName != this.room.architectureName) {
      this._baseGridName = this.room.architectureName
      let imgSrc = this.room.architecturePath + uri`/${this.room.architecture.pathfinding}`
      this._baseGrid = await pathfindingGridFromImage(imgSrc)
    }
    return this._baseGrid.clone()
  }

  // uses Pathfinding library to find a path around obstacles, results are in 0.0-1.0 coordinate space
  async findPath(startX, startY, endX, endY) {
    let grid = await this.getPathfindingGrid()
    let finder = new PF.AStarFinder({ allowDiagonal: true })
    let path = finder.findPath(startX, startY, endX, endY, grid)
    return path.map(([x,y])=> [
      x / grid.width,
      y / grid.height,
    ])
  }

  getGraphicSize() {
    return {
      width: Math.max(...this.room.architecture.layers.map(x => x.info.width)),
      height: Math.max(...this.room.architecture.layers.map(x => x.info.height)),
    }
  }

  getViewport() {
    if (!this.element) return { width: 1280, height: 720 }
    let graphicSize = this.getGraphicSize()
    let ratio = (graphicSize.height / graphicSize.width)
    return {
      width: this.element.clientWidth,
      height: Math.round(this.element.clientWidth * ratio)
    }
  }

  handleClick(event) {
    // calculate position of the click
    let element = this.element
    let [mouseX, mouseY] = mouseOffset(event, element)
    let viewport = this.getViewport()
    let scaledPosition = {
      x: Math.max(0.0, Math.min(mouseX / viewport.width, 1.0)),
      y: Math.max(0.0, Math.min((mouseY + this.element.scrollTop) / viewport.height, 1.0))
    }
    scaledPosition.z = this.xyToZ(scaledPosition.x, scaledPosition.y)
    console.log("Clicked @ ", scaledPosition)
    event.preventDefault()
    this.room.updateAttributes(scaledPosition)
    return false
  }

  zScale(zFloat) {
    let clamped = Math.max(0.0, Math.min(parseFloat(zFloat), 1.0))
    return Math.round(clamped * 10000)
  }

  // guess a Z value (centre bottom edge based) from camera angle and 2d coordinates
  xyToZ(x, y) {
    let degrad = 180 / Math.PI
    // load camera angle from architecture file
    let cameraAngleDeg = this.room.architecture.cameraAngle
    // default to isometric angle if not set
    if (typeof(cameraAngleDeg) != 'number') cameraAngleDeg = (Math.atan(4 / 3) * degrad)
    // figure out how much we need to adjust by orthographic perspective to calculate an accurate Z value
    let scaling = Math.sin(cameraAngleDeg / degrad)
    // return a scaled Z-Index integer number
    return y * scaling
  }

  xyToZIndex(x, y) { return this.zScale(this.xyToZ(x, y)) }

  // gets layer components in an array
  get layers() {
    if (!this.room || !this.room.architecture) return [] // skip if the data isn't available yet

    let layers = this._weakmap.get(this.room.architecture.layers)
    if (!layers) { // if it's not built yet for this architecture, build it and cache it
      this._weakmap.set(
        this.room.architecture.layers,
        layers = this.room.architecture.layers.map((layerConfig, layerIndex) => {
          let layer = new MapLayer({ map: this, layerIndex })
          layer.style.zIndex = ()=> layerConfig.z !== undefined ? this.zScale(layerConfig.z).toString() : this.xyToZIndex(layer.x, layer.y).toString()
          return layer
        })
      )
    }
    return layers
  }

  // computes how scaled the avatar should be, defaulting to 1.0, overridden by architecture 'avatarScale' property
  // and if an 'avatarFarScale' property is present, the value is scaled between avatarScale and avatarFarScale depending on y coordinates
  computeAvatarScale(avatar) {
    let { x, y } = avatar.person.attributes
    let { avatarScale, avatarFarScale } = this.room.architecture
    let worldScale = this.getViewport().width / 1000
    if (Number.isFinite(avatarScale)) {
      if (Number.isFinite(avatarFarScale)) {
        return ((avatarScale * y) + (avatarFarScale * (1.0 - y))) * worldScale
      } else {
        return avatarScale * worldScale
      }
    } else {
      return 1.0 * worldScale
    }
  }

  // gets an avatar for a person object
  // caching components in a WeakMap
  avatarForPerson(person) {
    let avatar = this._weakmap.get(person)
    if (!avatar) {
      this._weakmap.set(person, avatar = new Avatar({
        room: this.room, person,
        onClick: (event)=> {
          if (this.onClickPerson) this.onClickPerson(event, person)
        }
      }))

      // setup dynamic styles linked back to this object's state and style info
      avatar.style.zIndex = ()=> this.xyToZIndex(avatar.person.attributes.x, avatar.person.attributes.y).toString()
      avatar.style.left = ()=> `${(avatar.person.attributes.x * this.getViewport().width)}px`
      avatar.style.top = ()=> `${(avatar.person.attributes.y * this.getViewport().height)}px`
      avatar.style.setVariables({
        scale: ()=> `${this.computeAvatarScale(avatar)}`
      })
    }
    return avatar
  }

  // get avatar components as an array
  get avatars() {
    if (!this.room || !this.room.people) return []

    let people = Object.values(this.room.people)
    return people.map(person => this.avatarForPerson(person))
  }

  // createLayerElement(config) {
  //   let src = this.room.architecturePath + uri`/${config.url}`
  //   let srcSet = [src]
  //   let regexp = /\.(jpg|jpeg|png|gif|webp|jp2|mp4|mkv|webm)$/i
  //   if (this.room.architecture["@2x"]) srcSet.push(src.replace(regexp, `${encodeURIComponent('@2x')}.$1 2x`))
  //   if (this.room.architecture["@3x"]) srcSet.push(src.replace(regexp, `${encodeURIComponent('@3x')}.$1 3x`))

  //   let pixelScale = this.getPixelScale()
  //   let canvasSize = this.getCanvasSize()

  //   let style = {
  //     zIndex: this.zScale(config.z),
  //     left: `${(config.x || 0) * (canvasSize.width - (config.info.width * pixelScale))}px`,
  //     top: `${(config.y || 0) * (canvasSize.height - (config.info.height * pixelScale))}px`,
  //     width: `${Math.round(config.info.width * pixelScale)}px`,
  //     height: `${Math.round(config.info.height * pixelScale)}px`,
  //   }
    
  //   return html`<img class="layer" src="${src}" srcset="${srcSet.join(',\n')}" style="${inlineStyle(style)}">`
  // }

  // create HTML element that will morph in to presence list containing all the avatars
  createElement() {
    let viewport = this.getViewport()
    this.viewportStyle.width = `${viewport.width}px`
    this.viewportStyle.height = `${viewport.height}px`

    return html`<div class="layer-map" onclick=${this.handleClick} style="${this.style}">
      <div class="layer-viewport" style="${this.viewportStyle}">
        ${this.layers.map(x => x.render())}
        ${this.avatars.map(x => x.render())}
      </div>
    </div>`
  }

  // only do updates at this level when the members in the room change
  update() {
    return true

    // if the architecture changed, rerender
    if (this._renderedArchtectureName != this.room.architectureName) {
      this._renderedArchtectureName = this.room.architectureName
      return true
    }

    let peopleKeys = Object.keys(this.room.people)
    let peopleChanged = peopleKeys.some((value, index) => this.peopleKeyCache[index] != value)
    this.peopleKeyCache = peopleKeys

    // if anyone's left or joined, rerender presence list
    if (peopleChanged) {
      return true
    } else { // otherwise, just ask the avatars to consider rerendering in place
      Object.values(this.room.people).forEach(person => this.renderAvatarWithStyles(this.avatarForPerson(person)))
      return false
    }
  }

  // rerender when element is added to document, as it now has a size and things need to rescale
  load() {
    this.rerender()
    document.addEventListener('resize', this._resizeListener = ()=> { this.rerender() })
  }

  unload() {
    if (this._resizeListener) {
      document.removeEventListener('resize', this._resizeListener)
    }
  }
}

module.exports = LayerMapComponent