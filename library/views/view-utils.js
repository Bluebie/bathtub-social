// general utilities library of useful functions that get reused a lot
const fs = require('fs-extra')
const crypto = require('crypto')

const appRootPath = require('app-root-path')
const config = appRootPath.require('package.json').bathtub
const URL = require('url').URL

let decacheCache = {}

let ViewUtils = {
  // accepts a path, relative to root of site, and hashes the file it references, creating a relative url to embed in html
  // this ensures any caching happening in browser is invalidated
  decache: (path)=> {
    // if we've already checked this file, return the same value
    if (decacheCache[path]) return decacheCache[path]

    // make sure paths are consistent
    if (!path.startsWith("/")) path = `/${path}`
    // trim off build section
    if (path.startsWith("/build/")) path = path.substr(6)
    // if in production mode, hash the files and cache the hashes
    if (!config.development) {
      // hash the file
      let hash = crypto.createHash('sha256')
      hash.update(fs.readFileSync(appRootPath.resolve(`build/${path}`)))
      return (decacheCache[path] = `${ViewUtils.pathURL(path)}?version=${hash.digest('hex').slice(0, 8)}`)
    } else { // otherwise, just put the current time, to prevent any client side caching
      return `${ViewUtils.pathURL(path)}?version=time-${Date.now().toString(36)}`
    }
  },

  // adjust paths for inclusion in HTML to take in to account mount point in site
  pathURL: (localPath)=> {
    // make sure paths are consistent
    if (!localPath.startsWith("/")) localPath = `/${localPath}`
    // trim off build section
    if (localPath.startsWith("/build/")) localPath = localPath.substr(6)
    // create a relative url
    let siteLocation = new URL(config.location)
    let url = new URL(localPath, siteLocation)
    // return a relative url
    return url.pathname
  },
}

module.exports = ViewUtils