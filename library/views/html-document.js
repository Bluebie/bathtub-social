const html = require('nanohtml')
const raw = require('nanohtml/raw')
const URL = require('url').URL
const { decache, pathURL } = require('./view-utils')
const config = require('../../package.json').bathtub

class DocumentTemplate {
  constructor({ title, disable }) {
    this.title = title
    this.disable = disable || {}
  }

  async setBody(bodyProvider) {
    await bodyProvider.load()
    this.body = bodyProvider
  }

  toHeadHTML() {
    let pieces = [
      html`<title>${this.title}</title>`,
      html`<meta charset="utf-8">`,
      html`<link rel="stylesheet" href="${decache("style/sheet.css")}">`,
      ...this.body.getHeadTags(),
      html`<meta name="viewport" content="width=device-width">`,
      //html`<link rel=icon type="image/png" sizes="32x32" href="${pathURL("style/favicon-32x32.png")}">`,
    ]

    // if the body provider wants to include some data, emit a BathtubData javascript object
    let data = this.body.getData()
    if (Object.keys(data).length > 0) {
      pieces.push(html`<script>window.BathtubData = ${raw(JSON.stringify(data))}</script>`)
    }

    pieces.push(html`<script defer src="${decache("build/bundle.js")}"></script>`)

    // allow page providers to override opengraph properties
    let openGraph = {
      ...this.openGraph,
      ...this.body.getOpenGraph()
    }

    Object.entries(openGraph).map(([key, value]) =>
      pieces.push(html`<meta property="og:${key}" content="${value}">`)
    )
    return html`<head>${pieces}</head>`
  }

  toBodyHTML() {
    return html`<body class="${this.body.getPageType()}" data-json="${JSON.stringify(this.body.getData())}">
      ${this.body.toHTML()}
    </body>`
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