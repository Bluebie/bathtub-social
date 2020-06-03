// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const css = require('sheetify')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const mouseOffset = require('mouse-event-offset')
const PF = require('pathfinding')
const StyleObject = require('../features/style-object')
const deepEql = require('deep-eql')
const parseDuration = require('parse-duration')

const getPathfindingGrid = require('./get-pathfinding-grid')

/**
 * @typedef {Object} Coordinate2D
 * @property {Number} x
 * @property {Number} y
 */

const prefix = css`
  :host { position: absolute }
`

// generic container for objects like Avatars, which contains them and provides positioning
// and pathfinding animation
class MapObject extends nanocomponent {
  // constructor accepts an object, values inline
  constructor({
      map, // reference to Map component instance from ./map.js
      child, // reference to a nanocomponent to host
      style = {}, // optional initial inline styles
      anchor = { x: 0.5, y: 1.0 } // relative position to anchor x and y coordinates to
    })
  {
    super()
    /** @type {MapComponent} */
    this.map = map
    /** @type {nanocomponent} */
    this.child = child

    this.style = new StyleObject(style)

    /** @type {Coordinate2D} */
    this.anchor = anchor
    /** @type {Coordinate2D} */
    this.position = { x: 0, y: 0 }

    this.easingFunction = 'cubic-bezier(.26,.03,.87,1)'
  }

  get width() { return this.element.clientWidth }
  get height() { return this.element.clientHeight }

  // calculates style values to position this MapObject at the given coordinates
  calculatePositionStyles(x, y) {
    let viewport = this.map.getViewport()

    // compute scale
    let { avatarScale, avatarFarScale } = this.map.room.architecture
    let worldScale = viewport.width / 1000
    if (Number.isFinite(avatarScale)) {
      if (Number.isFinite(avatarFarScale)) {
        var scale = Math.round(((avatarScale * y) + (avatarFarScale * (1.0 - y))) * worldScale * 5000) / 5000
      } else {
        var scale = Math.round(avatarScale * worldScale * 5000) / 5000
      }
    } else {
      var scale = Math.round(1.0 * worldScale * 5000) / 5000
    }
    
    // return css properties appropriate for this object to place it in the supplied coordinates
    return {
      zIndex: `${this.map.xyToZIndex(x, y)}`,
      left: `${Math.round((x * viewport.width) - (this.width * (1.0 - this.anchor.x)))}px`,
      top: `${Math.round((y * viewport.height) - (this.height * (1.0 - this.anchor.y)))}px`,
      transform: `scale(${scale}) translateY(${Math.round(this.height * (1.0 - scale))}px)`,
      // TODO: Experiment with translate using a percentage
      // transform: `scale(${scale}) translateY(${(1.0 - scale) * 100}%)`
    }
  }

  // moves this MapObject to a specific abstract x,y location on the map
  async setPosition(x, y) {
    console.log("Set Position called", x, y)
    // ensure last animation has finished
    if (this.animation) await this.animation.finished
    // extremely quick animation to new location
    /** @type {Animation} */
    this.animation = this.element.animate(
      [
        { offset: 0, ... this.calculatePositionStyles(this.position.x, this.position.y) },
        { offset: 1, ... this.calculatePositionStyles(x, y) }
      ],
      { duration: 0, fill: 'forwards' }
    )
    
    this.position = { x, y }
    await this.animation.finished
  }

  async walkToPosition(x, y) {
    console.log("Walk To Position called", x, y)
    let grid = await getPathfindingGrid(this.map)
    let finder = new PF.AStarFinder({ allowDiagonal: true })
    let prev = this.position
    let path = finder.findPath(
      // start coordinates in the grid
      Math.round(prev.x * grid.width), Math.round(prev.y * grid.height),
      // end coordinates in the grid
      Math.round(x * grid.width), Math.round(y * grid.height),
      grid
    )

    // if pathfinding failed, just move them there immediately
    if (path.length < 2) {
      return this.setPosition(x, y)
    }

    // smooth and compress the path
    path = PF.Util.smoothenPath(grid, path).map(([x,y])=> [ x / grid.width, y / grid.height ])
    // remove the grid rounding from the last segment, make it exactly right
    path[path.length-1] = [ x, y ]

    console.log("Raw walk path", path)

    // pythagorus theorum to calculate distance
    let yScaling = this.map.yScaling
    // TODO: scale distance traveled by the avatar scaling value at each coordinate averaged together
    let getDistance = (a, b)=> Math.sqrt(Math.pow(Math.abs(b[0] - a[0]), 2) + Math.pow(Math.abs(b[1] - a[1]) / yScaling, 2))
    
    // iterate over path, building Web Animations API data structures
    let prevPathSegment = path[0]
    let distanceTraveled = 0
    let keyframes = path.map(segment => {
      distanceTraveled += getDistance(prevPathSegment, segment)
      prevPathSegment = segment
      return {
        offset: distanceTraveled,
        ... this.calculatePositionStyles(...segment)
      }
    })
    // populate options with duration
    let options = {
      duration: distanceTraveled * 4000,
      fill: 'forwards',
      easing: this.easingFunction,
    }
    // rescale offsets to within 0.0 to 1.0 range
    keyframes.forEach(keyframe => keyframe.offset /= distanceTraveled)

    // add easing functions to first and last keyframe
    // if (keyframes.length > 2) {
    //   keyframes[0].easing = 'ease-in'
    //   keyframes.slice(-2).forEach(keyframe =>
    //     keyframe.easing = keyframes.length == 2 ? 'ease-in-out' : 'ease-out'
    //   )
    // } else {
    //   keyframes.forEach(keyframe => keyframe.easing = 'ease-in-out')
    // }

    // make sure any past animations have finished
    if (this.animation) await this.animation.finished
    // Finally the data structures are fully built! lets run the animation!
    /** @type {Animation} */
    this.animation = this.element.animate(keyframes, options)
    console.log("Animate called", keyframes, options)
    this.position = { x, y }
    await this.animation.finished
  }

  createElement() {
    return html`<div class="map-object ${prefix}" style="${this.style}">${this.child.render()}</div>`
  }

  update() {
    return true
  }
}

module.exports = MapObject