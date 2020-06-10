const html = require('nanohtml')
const PNGSync = require('pngjs3').sync
require('isomorphic-fetch')

class DepthMap {
  constructor(png) {
    /** @type {Number} */
    this.width = png.width
    /** @type {Number} */
    this.height = png.height
    /** @type {Number} */
    this.depth = png.depth
    /** @type {Uint16Array|Uint8Array} */
    this.data = new png.data.constructor(this.width * this.height)
    // copy in just the first channel from the RGBA data
    this.data.forEach((v, index) => this.data[index] = png.data[index * 4])
  }

  getDepthAt(x, y) {
    let pxX = Math.round(x * (this.width - 1))
    let pxY = Math.round(y * (this.height - 1))
    let data = this.data
    let maxValue = Math.pow(2, this.depth) - 1
    let index = (this.width * pxY) + pxX
    return data[index] / maxValue
  }

  /** Build a mask image, suitable for use with css mask-image, returning a data-uri
   *  @param {Number} x - coordinates between 0.0 and 1.0 to center the mask on
   *  @param {Number} y - coordinates between 0.0 and 1.0 to center the mask on
   *  @param {Number} depth - 0.0 to 1.0 value indicating what depth to mask at
   *  @param {Number} width - integer pixel width of mask
   *  @param {Number} height - integer pixel height of mask
   *  @returns {ImageData} - a white ImageData with the mask represented by the alpha channel
   */
  getMask(x, y, depth, width, height) {
    let imageData = new ImageData(width, height)

    let depthThreshold = depth * (Math.pow(2, this.depth) - 1)
    let pxX = Math.round(x * (this.width - 1))
    let pxY = Math.round(y * (this.height - 1))
    for (let y = 0; y < imageData.height; y++) {
      let start = Math.floor((pxY + y) - (height / 2)) * this.width + Math.floor(pxX - (width / 2))
      // ensure it doesn't try to read out of bounds for the source array
      //if (start < 0) start = 0
      //if (start + width > this.data.length) start = this.data.length - width
      let end = start + width
      let sourceLine = this.data.subarray(start, end)

      for (let x = 0; x < imageData.width; x++) {
        let mi = ((y * imageData.width) + x) * 4
        let mask = sourceLine[x] < depthThreshold
        // white
        imageData.data[mi+0] = imageData.data[mi+1] = imageData.data[mi+2] = 255
        // vary alpha with masking
        imageData.data[mi+3] = mask ? 0 : 255
        // debug:
        //imageData.data[mi+3] = sourceLine[x] / 256
      }
    }
    return imageData
  }
}

DepthMap.loadPNGBuffer = async (pngBuffer)=> {
  let png = PNGSync.read(pngBuffer, {
    skipRescale: true, // maintain 16-bit data, don't convert to 8-bit
  })
  return new DepthMap(png)
}

DepthMap.loadURL = async (url)=> {
  let response = await fetch(url)
  let data = await response.arrayBuffer()
  return await DepthMap.loadPNGBuffer(new Buffer(data))
}

module.exports = DepthMap