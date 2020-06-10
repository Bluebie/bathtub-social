// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag')

// UI Objects
const StyleObject = require('../features/style-object')
const Avatar = require('./avatar')
const MapObject = require('./map-object')
const DepthMap = require('./depthmap')

// utilities
const mouseOffset = require('mouse-event-offset')
const deepEql = require('deep-eql')
const loadImage = require('../features/load-image')

const config = require('../../package.json')

// weakmap to store MapObject references related to people in the associated room
const objects = new WeakMap()

class DepthMapComponent extends nanocomponent {
  constructor({ room, onMoveTo, style, onClickPerson }) {
    super()
    this.room = room
    this.avatarMap = new WeakMap()
    this.onMoveTo = onMoveTo || ((location) => { console.log("Floor Position Click:", person)})
    this.handleClick = this.handleClick.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.style = new StyleObject(style)
    this.onClickPerson = onClickPerson

    this.style = new StyleObject()
    this.viewportStyle = new StyleObject()
  }

  // get graphics scale
  get scale() {
    return this.element.clientWidth / Math.max(...this.room.architecture.layers.map(x => x.info.width))
  }

  getGraphicSize() {
    return {
      width: Math.max(...this.room.architecture.layers.map(x => x.info.width)),
      height: Math.max(...this.room.architecture.layers.map(x => x.info.height)),
    }
  }

  // gets the width and height of the map viewport
  getViewport() {
    if (!this.element) return { width: 1280, height: 720 }

    let graphicSize = this.getGraphicSize()
    let ratio = (graphicSize.height / graphicSize.width)
    return this.getViewport.cache = {
      width: this.element.clientWidth,
      height: Math.round(this.element.clientWidth * ratio),
    }
  }

  mouseEventToPosition(event) {
    // calculate position of the click
    let element = this.element
    let [mouseX, mouseY] = mouseOffset(event, element)
    let viewport = this.getViewport()
    let scaledPosition = {
      x: Math.max(0.0, Math.min(mouseX / viewport.width, 1.0)),
      y: Math.max(0.0, Math.min((mouseY + this.element.scrollTop) / viewport.height, 1.0))
    }
    // limit precision for more efficiency and better screen display
    scaledPosition.x = Math.round(scaledPosition.x * 10000) / 10000
    scaledPosition.y = Math.round(scaledPosition.y * 10000) / 10000
    scaledPosition.z = this.xyToZ(scaledPosition.x, scaledPosition.y)
    return scaledPosition
  }

  handleClick(event) {
    let position = this.mouseEventToPosition(event)
    if (this.onMoveTo) this.onMoveTo(position)
    event.preventDefault()
    return false
  }

  handleMouseMove(event) {

  }

  zScale(zFloat) {
    let clamped = Math.max(0.0, Math.min(parseFloat(zFloat), 1.0))
    return Math.round(clamped * 10000)
  }

  // gets camera angle from architecture or defaults to isometric
  get cameraAngle() {
    if (typeof(this.room.architecture.cameraAngle) == 'number') {
      return this.room.architecture.cameraAngle
    } else { // default to isometric
      return (Math.atan(4 / 3) * 180 / Math.PI)
    }
  }

  // returns a scaling value which can be used to compute things like the ratio of vertical movement speed compared to horizontal
  get yScaling() {
    // conversion from degrees to radians
    let degrad = 180 / Math.PI
    // figure out how much we need to adjust by orthographic perspective to calculate an accurate Z value
    return Math.sin(this.cameraAngle / degrad)
  }

  // guess a Z value (centre bottom edge based) from camera angle and 2d coordinates
  xyToZ(x, y) {
    // return a scaled Z-Index integer number
    return y * this.yScaling
  }

  xyToZIndex(x, y) { return this.zScale(this.xyToZ(x, y)) }

  
  async handlePersonChange(person, changes) {
    let mapObj = this.getMapObjectForPerson(person)
    if ('attributes' in changes && ('x' in changes.attributes || 'y' in changes.attributes)) {
      await mapObj.walkToPosition(person.attributes.x, person.attributes.y)
    }
    // re-render so it can update itself too, in case of stuff like avatar changes
    mapObj.render()
  }

  // called when server issues a bulk statement of who is in the room
  handlePeopleChange() {
    this.rerender()
  }

  // gets a MapObject for a person from the cache, or creates one if necessary
  getMapObjectForPerson(person) {
    /** @type {MapObject} */
    let mapObject = objects.get(person)
    if (mapObject) return mapObject
    mapObject = new MapObject({
      map: this,
      anchor: { x: 0.5, y: 0.75 },
      child: new Avatar({
        map: this, person,
        onClick: (event)=> {
          if (this.onClickPerson) this.onClickPerson(event, person)
        },
        isMyself: person.identity == this.room.myself.identity
      })
    })
    objects.set(person, mapObject)
    return mapObject
  }

  // get MapObjects as an array, currently just MapObjects containing Avatars
  // sometimes map is rendered when the room hasn't been created or loaded yet, in that case, return nothing
  get mapObjects() {
    if (!this.room) return []
    return Object.values(this.room.people)
      .map(person => this.getMapObjectForPerson(person))
      //.sort((a,b) => a.position.y - b.position.y)
  }


  createElement() {
    // let graphicSize = this.getGraphicSize()
    // let heightRatio = graphicSize.height / graphicSize.width
    return html`<div class="layer-map depth-map" onclick=${this.handleClick} onmousemove=${this.handleMouseMove}>
      ${this.assets && this.assets.background && this.assets.background.image}
      <div class="dynamic-objects">
        ${this.mapObjects.map(x => x.render())}
      </div>
    </div>`
  }

  getArchitecturePath(filename) {
    return  uri`/configuration/architectures/${this.architecture.name}/${filename}`
  }

  /** load an architecture object in to the map state
   * @param {String} name - name of the architecture, used to generate URLs
   * @param {Object} configObject - architecture config object, found in config.json in the architecture folder normally
   */
  async loadArchitecture(name, configObject) {
    // skip if already loaded
    if (this.architecture && this.architecture.name == name) return

    this.architecture = {
      ...configObject,
      name, loaded: false,
    }
    // preload all the assets
    this.assets = {}
    let tasks = []
    this.architecture.layers.forEach(layer => {
      this.assets[layer.name] = {}
      console.log('layer', layer)
      if (layer.image) tasks.push((async ()=> {
        this.assets[layer.name].image = await loadImage(this.getArchitecturePath(layer.image))
      })())
      if (layer.mask) tasks.push((async ()=> {
        this.assets[layer.name].mask = await loadImage(this.getArchitecturePath(layer.mask))
      })())
      if (layer.depth) tasks.push((async ()=> {
        this.assets[layer.name].depth = await DepthMap.loadURL(this.getArchitecturePath(layer.depth))
      })())
    })
    // wait for everything to finish loading in before resolving
    await Promise.all(tasks)
    this.architecture.loaded = true
  }

  // only do updates at this level when the members in the room change
  update() {
    return true
  }

  // rerender when element is added to document, as it now has a size and things need to rescale
  async load() {
    console.log('map loading')
    await this.loadArchitecture(this.room.architectureName, this.room.architecture)
    this.rerender()
    document.addEventListener('resize', this.resizeListener = ()=> { this.render() })
  }

  unload() {
    if (this._resizeListener) {
      document.removeEventListener('resize', this.resizeListener)
    }
  }
}

module.exports = DepthMapComponent