// initialises qiao's PathFinding.js library with a grid from a black and white thresholded image
const PF = require('pathfinding')
const loadImage = require('./load-image')
const loadScaledImageData = require('./load-scaled-image-data')

// loads a pathfinding grid from an image URL, with a set width and appropriately scaled height based on
// cameraAngle in degrees
module.exports = async function pathfindingGridFromImage(imageUrl, width = 512, cameraAngle = 45) {
  // load the Image
  let img = await loadImage(src)
  // calculate how tall this grid should be, from maintaining the image's ratio
  let topViewHeight = img.height / img.width * width
  // calculate how distorted the view is from a non-topdown camera angle
  let heightScaling = Math.sin(cameraAngle / (180 / Math.PI))
  // calculate an integer height for the grid that maintains a topdown sort of perspective in the grid scaling
  let height = Math.round(topViewHeight / heightScaling)
  // load image data scaled to that shape
  let imageData = loadScaledImageData(imageUrl, width, height)
  let threshold = 255 / 2

  let matrix = []
  for (let y = 0; y < imageData.height; y++) {
    let row = []
    let yStart = x * (imageData.width * 4)
    for (let x = 0; x < imageData.width; x++) {
      let green = imageData.data[yStart + (x * 4) + 1]
      row.push(green > threshold ? 0 : 1)
    }
  }

  let grid = new PF.Grid(matrix)
  return grid
}