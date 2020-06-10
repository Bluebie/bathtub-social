// component renders a single chat bubble
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const css = require('sheetify')
const uri = require('encodeuricomponent-tag') // uri encodes template literals
const mouseOffset = require('mouse-event-offset')
const PF = require('pathfinding')
const StyleObject = require('../features/style-object')
const DepthMap = require('./depthmap')
const deepEql = require('deep-eql')
const parseDuration = require('parse-duration')
const anime = require('animejs')

const getPathfindingGrid = require('./get-pathfinding-grid')

/**
 * @typedef {Object} Coordinate2D
 * @property {Number} x
 * @property {Number} y
 */

const prefix = css`
  :host {
    position: absolute;
    overflow: hidden;
    mask-mode: luminance;
    -webkit-mask-mode: luminance;
    mask-type: luminance;
    mask-size: 100% 100%;
    -webkit-mask-size: 100% 100%;
  }
`

// generic container for objects like Avatars, which contains them and provides positioning
// and pathfinding animation
class MapObject extends nanocomponent {
  // constructor accepts an object, values inline
  constructor({
      map, // reference to Map component instance from ./map.js
      child, // reference to a nanocomponent to host
      style = {}, // optional initial inline styles
      anchor = { x: 0.5, y: 1.0 }, // relative position to anchor x and y coordinates to
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

    //this.easingFunction = 'cubicBezier(.26,.03,.87,1)'
    this.easingFunction = 'linear'

    this.maskPreview = html`<img>`
    this.maskPreview.style.position = 'absolute'
    this.maskPreview.style.top = '0'
    this.maskPreview.style.left = '0'
    this.maskPreview.style.pointerEvents = 'none'
    document.body.appendChild(this.maskPreview)
  }

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
      left: `${Math.round((
          (x * viewport.width) - (this.element.clientWidth / 2) - ((this.anchor.x - 0.5) * this.element.clientWidth * scale)
        ) * 10) / 10}px`,
      top: `${Math.round((
          (y * viewport.height) - (this.element.clientHeight / 2) - ((this.anchor.y - 0.5) * this.element.clientHeight * scale)
        ) * 10) / 10}px`,
      transform: `scale(${scale})`
    }
  }

  // moves this MapObject to a specific abstract x,y location on the map
  async setPosition(x, y) {
    // ensure last animation has finished
    if (this.animation) this.animation.pause()
    
    // change position and re-render
    this.position = { x, y }
    this.render()
  }

  async walkToPosition(x, y) {
    console.log("Walk To Position called", x, y)

    if (this.animation) {
      this.animation.pause()
    }

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
    // remove grid rounding from the first segment
    path[0] = [this.position.x, this.position.y]
    // remove the grid rounding from the last segment, make it exactly right
    path[path.length-1] = [ x, y ]

    // pythagorus theorum to calculate distance
    let yScaling = this.map.yScaling
    // TODO: scale distance traveled by the avatar scaling value at each coordinate averaged together
    let getDistance = (a, b)=> Math.sqrt(Math.pow(Math.abs(b[0] - a[0]), 2) + Math.pow(Math.abs(b[1] - a[1]) / yScaling, 2))
    
    // iterate over path, building Web Animations API data structures
    let prevPathSegment = path[0]
    let keyframes = path.map(segment => {
      let distance = getDistance(prevPathSegment, segment)
      prevPathSegment = segment
      return {
        duration: distance * 3000, // TODO: make this number adjustable
        x: segment[0], y: segment[1]
      }
    })

    console.log('keyframes', keyframes)

    // Finally the data structures are fully built! lets run the animation!
    this.animation = anime({
      targets: this.position,
      keyframes,
      easing: this.easingFunction,
      change: ()=> this.render(),
      complete: ()=> this.render(),
    })
  }

  createElement() {
    // update positioning styles if the element is in place
    if (this.element && this.child.element) {
      // update positioning styles
      this.style.set(this.calculatePositionStyles(this.position.x, this.position.y))

      /** @type {DepthMap} */
      let depthMap = this.map.assets.background.depth
      let { clientWidth: width, clientHeight: height } = this.child.element

      // get the depth map
      let scale = this.map.scale
      let maskWidth = Math.round(width / scale)
      let maskHeight = Math.round(height / scale)
      let depth = this.map.xyToZ(this.position.x, this.position.y)
      let mask = depthMap.getMask(this.position.x, this.position.y, depth, maskWidth, maskHeight)

      let canvas = html`<canvas width="${mask.width}" height="${mask.height}"></canvas>`
      let ctx = canvas.getContext('2d', { alpha: true })
      ctx.putImageData(mask, 0, 0)

      // find supported property name and set value
      let propertyName = ['mask-image', '-webkit-mask-image'].find(x => CSS.supports(x, 'url()'))
      let dataURI = canvas.toDataURL()
      this.maskPreview.src = dataURI
      this.style[propertyName] = `url('${dataURI}')`
    }

    return html`<div class="map-object ${prefix}" style="${this.style}">${this.child.render()}</div>`
  }

  update() {
    return true
  }

  load() {
    this.rerender()
  }
}

module.exports = MapObject