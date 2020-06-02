// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const mouseOffset = require('mouse-event-offset')
const PF = require('pathfinding')
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')
const parseDuration = require('parse-duration')

const Avatar = require('../views/component-avatar')
const pathfindingGridFromImage = require('../features/pathfinding-grid-from-image')

const MapLayer = require('./map-layer')
const MapObject = require('./map-object')

class MapComponent extends nanocomponent {
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
  // async getPathfindingGrid() {
  //   if (!this._baseGrid || this._baseGridName != this.room.architectureName) {
  //     this._baseGridName = this.room.architectureName
  //     let imgSrc = this.room.architecturePath + uri`/${this.room.architecture.pathfinding}`
  //     this._baseGrid = await pathfindingGridFromImage(imgSrc, 512, this.cameraAngle)
  //   }
  //   return this._baseGrid.clone()
  // }

  // // uses Pathfinding library to find a path around obstacles, results are in 0.0-1.0 coordinate space
  // async findPath(startX, startY, endX, endY) {
  //   let grid = await this.getPathfindingGrid()
  //   let finder = new PF.AStarFinder({ allowDiagonal: true })
  //   let path = finder.findPath(
  //     // start coordinates in the grid
  //     Math.round(startX * grid.width), Math.round(startY * grid.height),
  //     // end coordinates in the grid
  //     Math.round(endX * grid.width), Math.round(endY * grid.height),
  //     grid
  //   )
  //   return PF.Util.smoothenPath(grid, path).map(([x,y])=> [
  //     x / grid.width,
  //     y / grid.height,
  //   ])
  // }

  // converts output of this.findPath() to everything needed to call WebAnimations API
  // pathToAnimation(path) {
  //   let yScaling = this.yScaling
  //   let keyframes = []
  //   let options = { duration: 0 }
  //   let getDistance = (a, b)=> Math.sqrt(Math.pow(Math.abs(b[0] - a[0]), 2) + Math.pow(Math.abs(b[1] - a[1]) / yScaling, 2))
  //   let timePerDistance = parseDuration(this.room.architecture.walkDuration || '10s')
  //   let prev = path[0]
    
  //   // build the keyframes list
  //   path.forEach(now => {
  //     let [x, y] = now
  //     let distance = getDistance(prev, now)
  //     let stepTime = distance * timePerDistance
  //     options.duration += stepTime
  //     let computed = this.computeAvatarStylesForPosition(x, y)
  //     keyframes.push({
  //       offset: options.duration,
  //       transform: `translate(${computed.left}, ${computed.top}) ${computed.transform || ''}`
  //     })
  //   })
  //   // finally, scale the offset values to be within 0.0 and 1.0 in each keyframe
  //   keyframes.forEach(keyframe => {
  //     keyframe.offset = keyframe.offset / options.duration
  //   })
  //   // maybe duration needs to be an integer?
  //   options.duration = Math.round(options.duration)
  //   // return everything we need
  //   return { keyframes, options }
  // }

  // async animatePersonTo(person, x, y) {
  //   let avatar = this.avatarForPerson(person)
  //   let element = avatar.element
  //   if (!element) {
  //     console.warn("Can't walk Avatar, no DOM Element found")
  //     return
  //   }
  //   let path = await this.findPath(person.attributes.x, person.attributes.y, x, y)
  //   let { keyframes, options } = this.pathToAnimation(path)
  //   console.log("Animation", { keyframes, options })
  //   let animation = element.animate(keyframes, options)
  //   window.anim = animation
  //   this.anim = animation
  //   //animation.play()
  //   //animation.pause()
  //   console.log(animation)
  //   //await animation.finish
  //   //console.log('finished')
  // }

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
    return this.getViewport.cache = {
      width: this.element.clientWidth,
      height: Math.round(this.element.clientWidth * ratio),
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

  

  // computeAvatarScaleTransform(x, y) {
  //   let scale = Math.round(this.computeAvatarScale(x, y) * 5000) / 5000
  //   // TODO: Investigate if percentages can be used instead of 64 magic number, and if not, can the 64px number come from the avatar element somehow? calc()?
  //   return `scale(${scale}) translateY(${Math.round(64 * (1.0 - scale))}px)`
  // }

  // computeAvatarStylesForPosition(x, y) {
  //   let viewport = this.getViewport()
  //   return {
  //     zIndex: `${this.xyToZIndex(x, y)}`,
  //     left: `${Math.round(x * viewport.width)}px`,
  //     top: `${Math.round(y * viewport.height)}px`,
  //     //transform: this.computeAvatarScaleTransform(x, y)
  //   }
  // }

  // gets an avatar for a person object
  // caching components in a WeakMap
  avatarForPerson(person) {
    /** @type {MapObject} */
    let mapObject = this._weakmap.get(person)
    if (!mapObject) {
      this._weakmap.set(person, mapObject = new MapObject({
        map: this,
        anchor: { x: 0.5, y: 1.0 },
        child: new Avatar({
          room: this.room, person,
          onClick: (event)=> {
            if (this.onClickPerson) this.onClickPerson(event, person)
          },
          isMyself: person.identity == this.room.myself.identity
        })
      }))
    }

    return mapObject
  }

  async handlePersonChange(person) {
    let mapObj = this.avatarForPerson(person)
    if (mapObj.position.x != person.attributes.x || mapObj.position.y != person.attributes.y) {
      await mapObj.walkToPosition(person.attributes.x, person.attributes.y)
    }
    mapObj.child.render()
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

module.exports = MapComponent