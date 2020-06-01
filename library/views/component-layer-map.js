// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const mouseOffset = require('mouse-event-offset')
const PF = require('pathfinding')
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')

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

  // returns an object with all the input data that's relevent to rendering this layer
  get inputs() {
    return {
      url: this.config.url,
      maskImage: this.config.maskImage,
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
      maskImage: maskImage? `url("${this.assetURL(maskImage)})` : null
    })

    // render html
    return html`<img class="layer" src="${this.assetURL(url)}" style="${this.style}">`
  }

  // update if the viewport changed size, or if the architecture was changed by the server
  update() {
    return !deepEql(this.inputs, this.renderedInputs)
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
        },
        isMyself: person.identity == this.room.myself.identity,
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

  // create HTML element that will morph in to presence list containing all the avatars
  createElement() {
    let viewport = this.getViewport()
    this.viewportStyle.width = `${viewport.width}px`
    this.viewportStyle.height = `${viewport.height}px`
    this.renderedViewport = viewport

    return html`<div class="layer-map" onclick=${this.handleClick} style="${this.style}">
      <div class="layer-viewport" style="${this.viewportStyle}">
        ${this.layers.map(x => x.render())}
        ${this.avatars.map(x => x.render())}
      </div>
    </div>`
  }

  // only do updates at this level when the members in the room change
  update() {
    return this.layers.some(layer => layer.update())
        || this.avatars.some(avatar => avatar.update())
        || !deepEql(this.renderedViewport, this.getViewport())
  }

  // rerender when element is added to document, as it now has a size and things need to rescale
  load() {
    this.render()
    document.addEventListener('resize', this.resizeListener = ()=> { this.render() })
  }

  unload() {
    if (this._resizeListener) {
      document.removeEventListener('resize', this.resizeListener)
    }
  }
}

module.exports = LayerMapComponent