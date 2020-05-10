const html = require('nanohtml')
const raw = require('nanohtml/raw')
const URL = require('url').URL
const { decache, pathURL } = require('./view-utils')
const config = require('../../package.json').bathtub

class DocumentTemplate {
  constructor(body) {
    this.body = body
  }

  toHeadHTML() {
    let viewConfig = {
      view: this.body.constructor.name,
      options: this.body.options,
    }

    return html`<head>
      <title>${this.body.title || config.siteName}</title>
      <meta charset="utf-8">
      <link rel=stylesheet href="${decache('style/sheet.css')}">
      <meta name=viewport content="width=device-width">
      <script defer src="${decache("build/bundle.js")}" id="bathtub-bundle" data-view="${JSON.stringify(viewConfig)}"></script>
    </head>`
  }

  toBodyHTML() {
    return this.body.render()
  }

  toHTML() {
    return html`<!DOCTYPE html>
    <html lang="${config.writtenLanguage}">
      ${this.toHeadHTML()}
      ${this.toBodyHTML()}
    </html>`
  }
}

module.exports = DocumentTemplate