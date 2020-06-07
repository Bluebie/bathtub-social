const html = require('nanohtml')

/** Load an image as a html image element, returns promise
 * @param {String} url - path to image to be loaded
 * @returns {Image}
 * @async
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (typeof(Image) == 'function') {
      let img = new Image()
      img.onload = ()=> resolve(img)
      img.onerror = (err)=> reject(err)
      img.src = src
    } else {
      // if server side rendering, just resolve immediately with the placeholder markup
      resolve(html`<img src="${src}">`)
    }
  })
}

module.exports = loadImage