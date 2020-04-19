const html = require('nanohtml')

class BaseProvider {
  async load() {
    return null
  }
  
  getConfig() {
    return {}
  }
  
  getData() {
    return {}
  }

  getHeadTags() {
    return []
  }

  getOpenGraph() {
    return {}
  }

  getPageType() {
    return "generic-page"
  }

  toHTML() {
    return html`<!-- page provider hasn't implemented to toHTML() -->`
  }
}

module.exports = BaseProvider