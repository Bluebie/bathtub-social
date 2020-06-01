// component renders a color wheel for selecting a hue
const html = require('nanohtml')
const parseDuration = require('parse-duration')
const config = require('../../package.json').bathtub
const faceapi = require('face-api.js')
const toBuffer = require('blob-to-buffer')

function clamp(min, value, max) {
  return Math.max(min, Math.min(value, max))
}

class AvatarCaptureWidget {
  // Required options:
  //  - source: must be a <video> or similar element that canvas2d can use in a drawImage call
  // Optional:
  //  - size: override size from package.json
  //  - interval: override avatar capture interval, instead of value from from package.json
  //  - onAvatar: a callback function which is provided one argument, a Buffer containing image/jpeg data, when a mini avatar image is ready and compressed
  //  - tracking: either 'tiny', or 'ssd', to choose which face-api model to use for face tracking, or false to disable face tracking
  constructor({ source, size = config.avatarSize, interval = config.avatarInterval, tracking = 'tiny', onAvatar }) {
    this.source = source
    this.size = size
    this.interval = Math.round(parseDuration(interval))
    this.onAvatar = onAvatar
    
    this.tracking = tracking
    this.trackingZoom = 1.0
    this.trackingPan = { x: 0, y: 0.0 }
    this.trackingZoomCorrection = 1.0
    this.trackingPanCorrection = { x: 0, y: 0.0 }
    this.getCanvas.cache = html`<canvas></canvas>`
  }

  async setup() {
    if (this.setup.done == this.tracking) return
    this.setup.done = this.tracking
    if (this.tracking == 'tiny') {
      await faceapi.loadTinyFaceDetectorModel('/library/face-api-models/')
      this.trackingOptions = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3, inputSize: 256 })
      // corrections to calibrate how this detector tends to offset face boxes
      this.trackingZoomCorrection = 0.65
      this.trackingPanCorrection = { x: 0, y: -0.15 }
    } else if (this.tracking == 'ssd') {
      await faceapi.loadSsdMobilenetv1Model('/library/face-api-models/')
      this.trackingOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
      // corrections to calibrate how this detector tends to offset face boxes
      this.trackingZoomCorrection = 0.55
      this.trackingPanCorrection = { x: 0, y: -0.075 }
    }
  }

  // enable the filmstrip builder, start automatically capturing frames
  enable() {
    if (!this.enabled) {
      this.enabled = true
      this.capture()
    }
  }

  disable() {
    this.enabled = false
  }

  // capture a frame from the source
  async capture() {
    if (!this.enabled) return
    if (!this.source) throw new Error("Source must be set before capturing can be enabled")
    
    // ensure setup of any tracking models is complete
    await this.setup()

    // check the webcam feed is running on the video source, bail if not yet getting video
    if (this.source.paused || this.source.ended || this.source.played.length == 0) {
      setTimeout(()=> this.capture(), this.interval)
      console.warn("Avatar capture bailed, no video in the mirror player yet")
      return
    }

    let sourceSize = Math.min(this.source.videoWidth, this.source.videoHeight)
    let crop = {
      x: Math.round((this.source.videoWidth  - sourceSize) / 2),
      y: Math.round((this.source.videoHeight - sourceSize) / 2),
      width: sourceSize, height: sourceSize,
      source: this.source,
    }

    // if tracking is enabled, attempt to find a face, and override the default wide crop
    if (this.tracking && this.trackingOptions) {
      let detectTask = faceapi.detectSingleFace(this.source, this.trackingOptions)
      let detection = await detectTask
      // if a face was detected, override the crop to zoom in on the face
      if (detection) {
        let size = Math.max(detection.box.width, detection.box.height) / (this.trackingZoom * this.trackingZoomCorrection)
        let center = {
          x: detection.box.x + (detection.box.width  / 2) + ((this.trackingPan.x + this.trackingPanCorrection.x) * size),
          y: detection.box.y + (detection.box.height / 2) + ((this.trackingPan.y + this.trackingPanCorrection.y) * size),
        }
        crop.x = clamp(0, center.x - (size / 2), this.source.videoWidth  - size)
        crop.y = clamp(0, center.y - (size / 2), this.source.videoHeight - size)
        crop.width = crop.height = size
        crop.source = detectTask.input
      }
    }

    // draw the frame
    let canvas = this.getCanvas()
    let ctx = canvas.getContext('2d')
    //console.log(crop.source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    ctx.drawImage(crop.source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    // call it again to handle the next capture
    setTimeout(()=> this.capture(), this.interval)

    // if an event listener is set, render the jpeg out to a buffer and pass it to the callback
    if (this.onAvatar) {
      this.toBuffer().then(this.onAvatar)
    }
  }

  // INTERNAL: get the avatar canvas element
  getCanvas() {
    if (this.getCanvas.cache.width !== this.size) {
      this.getCanvas.cache.width = this.size
      this.getCanvas.cache.height = this.size
    }
    return this.getCanvas.cache
  }

  // convert current filmstrip to a WebAPI Blob
  async toBlob() {
    return new Promise((resolve, reject) => {
      this.getCanvas().toBlob(resolve, config.avatarMimeType, config.avatarQuality)
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