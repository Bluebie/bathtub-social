// component renders a color wheel for selecting a hue
const html = require('nanohtml')
const parseDuration = require('parse-duration')
const config = require('../../package.json').bathtub
const toBuffer = require('blob-to-buffer')

class FilmstripWidget {
  // Required options:
  //  - source: must be a <video> or similar element that canvas2d can use in a drawImage call
  // Optional:
  //  - size: override size from package.json
  //  - frames: override number of frames from package.json
  //  - interval: override filmstrip interval of completion from package.json
  //  - onFilmstrip: a callback function which is provided one argument, a Buffer containing image/jpeg data, when a filmstrip is completed
  constructor({ source, size, frames, interval, onFilmstrip }) {
    this.source = source
    this.size = size || config.filmstripSize
    this.frames = frames || config.filmstripFrames
    this.interval = Math.round(parseDuration(interval || config.filmstripInterval) / this.frames)
    this.onFilmstrip = onFilmstrip
    this.currentFrame = 0
    
    this.element = this.createElement()
    this.ctx = this.element.getContext('2d')
  }

  // enable the filmstrip builder, start automatically capturing frames
  enable() {
    this.disable()
    this.capture()
    setInterval(() => this.capture(), this.interval)
  }

  disable() {
    clearInterval(this.timer)
  }

  // capture a frame from the source
  capture() {
    if (!this.source) throw new Error("Source must be set before capturing can be enabled")

    let sourceSize = Math.min(this.source.videoWidth, this.source.videoHeight)
    let sourceX = Math.round((this.source.videoWidth  - sourceSize) / 2)
    let sourceY = Math.round((this.source.videoHeight - sourceSize) / 2)
    let filmOffset = this.currentFrame * this.size
    // draw the frame
    this.ctx.drawImage(this.source, sourceX, sourceY, sourceSize, sourceSize, 0, filmOffset, this.size, this.size)

    // step through the frame position
    this.currentFrame += 1
    if (this.currentFrame >= this.frames) {
      this.currentFrame = 0
      // if a filmstrip handler was defined, compress the image on the canvas and send it out to the callback
      if (this.onFilmstrip) this.toBuffer().then(this.onFilmstrip)
    }
  }

  // INTERNAL: create the html element
  createElement() {
    return html`<canvas width="${this.size}" height="${this.size * this.frames}"></canvas>`
  }

  // convert current filmstrip to a WebAPI Blob
  async toBlob(type = "image/jpeg", quality = 0.92) {
    return new Promise((resolve, reject) => {
      this.element.toBlob(resolve, type, quality)
    })
  }

  // convert current filmstrip to a Node-style Buffer
  async toBuffer(type = "image/jpeg", quality = 0.92) {
    return new Promise((resolve, reject) => {
      this.toBlob(type, quality).then(blob => {
        toBuffer(blob, (err, value)=> {
          if (err) reject(err)
          else resolve(value)
        })
      })
    })
  }
}

module.exports = FilmstripWidget