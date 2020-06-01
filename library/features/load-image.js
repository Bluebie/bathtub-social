// loads an image and resolves the Image instance when it's done loading
function loadImage(src) {
  return new Promise((resolve, reject) => {
    let img = new Image()
    img.onload = ()=> { resolve(img) }
    img.onerror = (...args)=> { reject(...args) }
    img.src = src
  })
}

module.exports = loadImage