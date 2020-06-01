// Badge Lock is a visual component for moderators and admins to provide their authentication
// file, it creates an abstract Badge object, verifies it with the server, and gives feedback
// about what their authorized role is on the server if it's recognised.
// This component fires it's optional onBadge and onFailure callbacks when server side
// validation resolves.
const nanocomponent = require('nanocomponent')
const html = require('nanohtml')
import { fileOpen } from 'browser-nativefs'
const blobToBuffer = require('blob-to-buffer')
const Badge = require('../crypto/badge')
const uri = require('encodeuricomponent-tag')
const StyleObject = require('../features/style-object')

class BadgeLock extends nanocomponent {
  constructor({ identity, onBadge, onFailure }) {
    super()
    this.identity = identity
    this.badge = null
    this.valid = null
    this.onBadge = onBadge
    this.onFailure = onFailure
    
    this.style = new StyleObject()
    this.onDragOver = this.onDragOver.bind(this)
    this.onDrop = this.onDrop.bind(this)
    this.onClick = this.onClick.bind(this)
  }

  async onClick(event) {
    let blob = await fileOpen({ mimeTypes: ['image/png', '.png'] })
    if (blob) this.processBlob(blob)
    event.preventDefault()
  }

  // enable drag and drop with correct styling
  async onDragOver(event) {
    event.stopPropagation()
    event.preventDefault()
    event.dataTransfer.dropEffect = 'link' // Style the drag-and-drop as a "link file" operation.
  }

  // enable drop of key file
  async onDrop(event) {
    event.stopPropagation()
    event.preventDefault()
    const fileList = event.dataTransfer.files
    if (fileList.length == 1) {
      this.buffer = Buffer.from(fileList[0].arrayBuffer())
      this.badge = new Badge(buffer)
      this.validate()
    }
  }

  // verify badge is valid and get info from server
  processBlob(blob) {
    let buffer = blobToBuffer(blob)
    this.badge = new Badge(buffer)
    this.badgeImage = URL.createObjectURL(blob)
    // ask the server to validate the badge
    let { valid, info } = await this.identity.postJSON(uri`/authorities/${this.badge.key}/verify`, {
      badge: badge.issue(this.identity)
    })
    // store result and rerender with updated information
    this.valid = valid
    this.info = info
    this.rerender()
    // fire any callbacks
    if (this.valid && this.onBadge) this.onBadge(this.badge)
    else if (!this.valid && this.onFailure) this.onFailure()
  }

  render() {
    let contents

    if (this.valid === true && this.badgeImage) {
      contents = html`<div class="valid-badge">
        <img class="badge-image" src="${this.badgeImage}" alt="picture of your administrator badge">
        <dl class="badge-stats">
          <dt>Role:</dt>    <dd>${this.info.role}</dd>
          <dt>Note:</dt>    <dd>${this.info.note}</dd>
          <dt>Created:</dt> <dd>${new Date(this.info.created)}</dd>
        </dl>
      </div>`
    } else if (this.valid === false) {
      contents = html`<div class="invalid-badge">The image you provided was not recognised as a valid badge</div>`
    } else {
      contents = html`<div class="dropzone-placeholder">Click to select your badge, or drag and drop it on to this text.</div>`
    }

    return html`<div class="badge-lock" onclick=${this.onClick} ondragover=${this.onDragOver} ondrop=${this.onDrop} style="${this.style}">
      ${contents}
    </div>`
  }

  update() {
    return true
  }
}

module.exports = BadgeLock