// Builds frontend main single page application markup
const html = require('nanohtml')
const raw = require('nanohtml/raw')
const fs = require('fs-extra')

const appRootPath = require('app-root-path')
const base = require('./provider-base')

class FrontendView extends base {
  getPageType() {
    return "frontend"
  }

  toHTML() {
    return html`<noscript>
      <h1>Javascript needs to be enabled to use this website</h1>
    </noscript>
    <h1>Todo: Implement any user interface at all...</h1>`
  }
}

module.exports = FrontendView