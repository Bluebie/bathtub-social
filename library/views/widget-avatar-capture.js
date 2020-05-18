// component renders a color wheel for selecting a hue
const html = require('nanohtml')
const parseDuration = require('parse-duration')
const config = require('../../package.json').bathtub
const toBuffer = require('blob-to-buffer')

class AvatarCaptureWidget {
  // Required options:
  //  - source: must be a <video> or similar element that canvas2d can use in a drawImage call
  // Optional:
  //  - size: override size from package.json
  //  - interval: override avatar capture interval, instead of value from from package.json
  //  - onAvatar: a callback function which is provided one argument, a Buffer containing image/jpeg data, when a mini avatar image is ready and compressed
  constructor({ source, size, interval, onAvatar }) {
    this.source = source
    this.size = size || config.avatarSize
    this.interval = Math.round(parseDuration(interval || config.avatarInterval))
    this.onAvatar = onAvatar
    
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
    // draw the frame
    this.ctx.drawImage(this.source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, this.size, this.size)

    if (this.onAvatar) this.toBuffer().then(this.onAvatar)
  }

  // INTERNAL: create the html element
  createElement() {
    return html`<canvas width="${this.size}" height="${this.size}"></canvas>`
  }

  // convert current filmstrip to a WebAPI Blob
  async toBlob() {
    return new Promise((resolve, reject) => {
      this.element.toBlob(resolve, config.avatarMimeType, config.avatarQuality)
    })
  }

  // convert current filmstrip to a Node-style Buffer
  async toBuffer() {
    return new Promise((resolve, reject) => {
      this.toBlob().then(blob => {
        toBuffer(blob, (err, value)=> {
          if (err) reject(err)
          else resolve(value)
        })
      })
    })
  }
}

module.exports = AvatarCaptureWidget