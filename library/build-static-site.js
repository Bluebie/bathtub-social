const config = require('../package.json').bathtub
const fs = require('fs-extra')
const zlib = require('zlib')
const browserify = require('browserify')
const beautify = require('js-beautify').html

const DocumentTemplate = require('./views/html-document')
const FrontendView = require('./views/view-frontend')

const appRoot = require('app-root-path')
const buildDir = appRoot.resolve('build')

const beautifyOptions = {
  indent_size: 2,
  max_preserve_newlines: 2
}

// writes a file with the contents of an in-memory buffer, and also writes
// gzipped and brotli compressed versions along side it, if they're smaller
async function zipper(path) {
  let buffer = await fs.readFile(path)
  let tasks = []

  // gzip data, if it's smaller, write the file, otherwise ensure it's removed if it exists
  let gzip = zlib.gzipSync(buffer, { level: 9 })
  if (gzip.length < buffer.length) {
    tasks.push(fs.writeFile(`${path}.gz`, gzip))
  } else {
    tasks.push(fs.remove(`${path}.gz`))
  }

  // brotli data, write it if it's smaller than original and gzip versions, otherwise ensure it's removed
  let brotli = zlib.brotliCompressSync(buffer)
  if (brotli.length < buffer.length && brotli.length < gzip.length) {
    tasks.push(fs.writeFile(`${path}.br`, brotli))
  } else {
    tasks.push(fs.remove(`${path}.br`))
  }

  return await Promise.all(tasks)
}

// pass it a directory, and it will try and zip everything in it recursively
// except items where the gzip or brotli would be larger than the original file
async function recursiveZip(path) {
  let listing = await fs.readdir(path, {withFileTypes: true})
  for (let entry of listing) {
    if (entry.isFile()) {
      console.info(`Zipping ${path}/${entry.name}`)
      await zipper(`${path}/${entry.name}`)
    } else if (entry.isDirectory()) {
      await recursiveZip(`${path}/${entry.name}`)
    }
  }
}

module.exports = async function() {
  // copy in style
  await fs.emptyDir(`${buildDir}/style`)
  await fs.copy(appRoot.resolve('style'), `${buildDir}/style`, { preserveTimestamps: true })
  await recursiveZip(`${buildDir}/style`)

  // build frontend javascript
  await (new Promise((resolve, reject) => {
    var b = browserify()
    b.add(appRoot.resolve('library/frontend.js'))
    b.transform("sheetify")
    b.bundle()
    .pipe(fs.createWriteStream(`${buildDir}/bundle.js`))
    .once("close", ()=> resolve())
  }))
  await zipper(`${buildDir}/bundle.js`)

  // build frontend
  let doc = new DocumentTemplate({ title: config.siteName })
  await doc.setBody(new FrontendView())
  await fs.writeFile(`${buildDir}/index.html`, beautify(doc.toHTML(), beautifyOptions))
  await zipper(`${buildDir}/index.html`)

  console.log("Static site rebuilt")
}

module.exports.devBundle = async () => {
  return (new Promise((resolve, reject) => {
    var b = browserify({ debug: true })
    b.add(appRoot.resolve('library/frontend.js'))
    b.transform("sheetify")
    b.bundle((err, buf) => {
      if (err) reject(new Error(err))
      else resolve(buf)
    })
  }))
}