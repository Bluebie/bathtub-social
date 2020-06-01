// this accepts an Image / <img>, scales it to a set width and height, and returns an ImageData structure of the pixels
function loadScaledImageData(img, width, height) {
  let canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  let ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  let imageData = ctx.getImageData(0, 0, width, height)
  return imageData
}

module.exports = loadScaledImageData