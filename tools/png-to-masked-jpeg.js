const fs = require('fs-extra')
const { createCanvas, loadImage, createImageData } = require('canvas')

/**
 * @typedef {Object} ChannelPair
 * @property {ImageData} color - an opaque RGB image
 * @property {ImageData} mask - a greyscale opaque mask image containing the alpha channel of the original alpha image
 * @property {true|false} hasTransparency - indicates if the input image contained any pixels that aren't fully opaque
 */

/** Read ImageData from an image file
 * @async
 * @param {String} path - path on filesystem to read RGBA image from
 * @returns {ImageData}
*/
async function readImage(path) {
  let image = await loadImage(await fs.readFile(path))
  let canvas = createCanvas(image.width, image.height)
  let context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height)
}

/** write a jpeg at path
 * @async
 * @param {String} path - path on filesystem to write jpeg
 * @param {ImageData} imageData - ImageData object containing RGB information to write to the JPEG
 * @param {Number} quality - number between 0.0 and 1.0 indicating jpeg compression quality
*/
async function writeJPEG(path, imageData, quality) {
  let canvas = createCanvas(imageData.width, imageData.height)
  let context = canvas.getContext('2d')
  context.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    let jpegStream = canvas.createJPEGStream({ quality })
    let fileStream = fs.createWriteStream(path)
    fileStream.on('error', reject)
    fileStream.on('close', resolve)
    jpegStream.pipe(fileStream)
  })
}

/** deep clone an ImageData
 * @param {ImageData} imageData - source object to copy
 * @returns {ImageData} - a deep clone of the input ImageData
 */
function cloneImageData(imageData) {
  let cloneData = new Uint8ClampedArray(imageData.data.length)
  cloneData.set(imageData.data, 0)
  return createImageData(cloneData, imageData.width, imageData.height)
}

/** subarray a pixel from an ImageData
 * @param {ImageData} imageData - input image data
 * @param {Number} x - integer x coordinate
 * @param {Number} y - integer y coordinate
 * @returns {Uint8ClampedArray} - 4 byte clamped array view in to this pixel
 */
function getPixel(imageData, x, y) {
  let channels = 4
  let lineOffset = y * imageData.width * 4
  let rowOffset = x * 4
  return imageData.data.subarray(lineOffset + rowOffset, lineOffset + rowOffset + channels)
}

/** split an ImageData with alpha information in to a color and an mask ImageData
 * @param {ImageData} imageData - RGBA image to split
 * @returns {ChannelPair}
 */
function splitChannels(imageData) {
  let color = cloneImageData(imageData)
  let mask = cloneImageData(imageData)
  let hasTransparency = false
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      let colorPixel = getPixel(color, x, y)
      // if alpha is exactly fully transparent, set pixel to black to remove unnecessary details
      /** @todo investigate if this creates too many compression artifacts */
      if (colorPixel[3] == 0) {
        colorPixel[0] = colorPixel[1] = colorPixel[2] = 0
      }
      // set alpha to 255 full opaque on color image
      colorPixel[3] = 255
      let maskPixel = getPixel(mask, x, y)
      // build mask by copying alpha channel to RGB channels
      maskPixel[0] = maskPixel[1] = maskPixel[2] = maskPixel[3]
      // update hasTransparency flag
      if (maskPixel[3] !== 255) hasTransparency = true
      // set alpha to full opaque
      maskPixel[3] = 255
    }
  }
  return { color, mask, hasTransparency }
}

/** given a filesystem path to a png with alpha transparency, write out files replacing .png with -color.jpeg and -mask.jpeg
 * @async
 * @param {String} inputPNGPath - path to png file
*/
async function pngToJPEGPair(inputPNGPath, jpegQuality = 0.95) {
  let inputImage = await readImage(inputPNGPath)
  let { color, mask, hasTransparency } = splitChannels(inputImage)
  let colorPath = inputPNGPath.replace(/\.png$/i, '-color.jpeg')
  let maskPath = inputPNGPath.replace(/\.png$/i, '-mask.jpeg')
  // write out color jpeg
  await writeJPEG(colorPath, color, jpegQuality)
  if (hasTransparency) {
    await writeJPEG(maskPath, mask, jpegQuality)
  }
}

let process = require('process')
var args = process.argv.splice(process.execArgv.length + 2)
args.forEach(async filename => {
  await pngToJPEGPair(filename)
  console.log("Split", filename)
})
