// Builds frontend main single page application markup
const html = require('nanohtml')
const nanocomponent = require('nanocomponent')

class FrontendView extends nanocomponent {
  constructor(options) {
    super()
    this.options = options
  }

  createElement() {
    return html`<body class="frontend">
      <p>Todo: Make a website</p>
    </body>`
  }
}

module.exports = FrontendView